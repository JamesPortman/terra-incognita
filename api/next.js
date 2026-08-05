// Host-driven state transitions: lobby -> question(0); question -> reveal (end
// round early); reveal -> question(n+1) | final. Writing the leaderboard happens
// exactly once, on the transition into final.
const { getStore } = require('./_lib/store.js');
const { getSql, ensureTable } = require('./_lib/db.js');
const { loadRoom, saveRoom, playersKey, ROUNDS, sendJSON } = require('./_lib/rooms.js');

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
      const players = Object.values(await getStore().hgetallJSON(playersKey(code)))
        .filter((p) => !/^E2E-/i.test(p.name));
      if (players.length) {
        await ensureTable();
        const sql = getSql();
        const DECK_LABELS = {
          world: 'World — Famous Places',
          na: 'North America — Famous Places',
          sa: 'South America — Famous Places',
          us: 'USA — Famous Places',
          random: 'Random world (Street View)',
        };
        const deckLabel = DECK_LABELS[meta.deckId] || 'World — Famous Places';
        for (const p of players) {
          await sql`INSERT INTO leaderboard (room_code, player_name, score, rounds, deck)
                    VALUES (${code}, ${p.name}, ${p.score}, ${rounds}, ${deckLabel})`;
        }
      }
    }
  } else {
    return sendJSON(res, 409, { error: 'game is over' });
  }
  await saveRoom(meta);
  sendJSON(res, 200, { state: meta.state, roundIdx: meta.roundIdx });
};
