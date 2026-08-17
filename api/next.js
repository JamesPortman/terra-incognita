// Host-driven state transitions: lobby -> question(0); question -> reveal (end
// round early); reveal -> question(n+1) | final. Writing the leaderboard happens
// exactly once, on the transition into final.
const { getStore } = require('./_lib/store.js');
const { getSql, ensureTable } = require('./_lib/db.js');
const {
  loadRoom, saveRoom, playersKey, guessesKey, roundDetail, LOCATIONS, ROUNDS, sendJSON,
} = require('./_lib/rooms.js');
const { DECK_LABELS } = require('../shared/decks.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method not allowed' });
  const code = String(req.body?.code || '').toUpperCase();
  const meta = await loadRoom(code);
  if (!meta) return sendJSON(res, 404, { error: 'room not found' });
  if (req.body?.hostToken !== meta.hostToken) return sendJSON(res, 403, { error: 'host only' });

  const rounds = meta.rounds || ROUNDS;
  if (meta.state === 'lobby' || (meta.state === 'reveal' && meta.roundIdx + 1 < rounds)) {
    meta.roundIdx += 1;
    meta.state = 'question';
    meta.roundStartAt = Date.now();
  } else if (meta.state === 'question') {
    meta.state = 'reveal';
  } else if (meta.state === 'reveal') {
    meta.state = 'final';
    if (!meta.savedToLb) {
      meta.savedToLb = true;
      // test agents (E2E-* names) never reach the persistent leaderboard
      const players = Object.entries(await getStore().hgetallJSON(playersKey(code)))
        .filter(([, p]) => !/^E2E-/i.test(p.name));
      if (players.length) {
        await ensureTable();
        const sql = getSql();
        const deckLabel = DECK_LABELS[meta.deckId] || DECK_LABELS.world;
        // per-round guesses back each row's map replay; they live only in
        // Redis (4h TTL), so this is the last chance to keep them
        const roundGuesses = [];
        for (let i = 0; i < rounds; i++) {
          roundGuesses.push(await getStore().hgetallJSON(guessesKey(code, i)));
        }
        for (const [pid, p] of players) {
          const detail = roundGuesses.map((g, i) =>
            roundDetail(meta.customDeck ? meta.customDeck[i] : LOCATIONS[meta.deck[i]], g[pid]));
          await sql`INSERT INTO leaderboard (room_code, player_name, score, rounds, deck, detail)
                    VALUES (${code}, ${p.name}, ${p.score}, ${rounds}, ${deckLabel}, ${JSON.stringify(detail)}::jsonb)`;
        }
      }
    }
  } else {
    return sendJSON(res, 409, { error: 'game is over' });
  }
  await saveRoom(meta);
  sendJSON(res, 200, { state: meta.state, roundIdx: meta.roundIdx });
};
