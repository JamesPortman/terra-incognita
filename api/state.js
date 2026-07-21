// Polled by host and players (~every 1.5s). Performs the lazy question->reveal
// transition, and shapes the response so answers never leak during a question.
const { getStore } = require('./_lib/store.js');
const {
  loadRoom, maybeAdvance, playersKey, guessesKey,
  ROUNDS, ROUND_MS, sendJSON,
} = require('./_lib/rooms.js');

module.exports = async (req, res) => {
  const code = String(req.query.code || '').toUpperCase();
  const { playerId, token, hostToken } = req.query;

  let meta = await loadRoom(code);
  if (!meta) return sendJSON(res, 404, { error: 'room not found' });

  const store = getStore();
  const players = await store.hgetallJSON(playersKey(code));
  const isHost = hostToken && hostToken === meta.hostToken;
  const isPlayer = playerId && players[playerId] && players[playerId].token === token;
  if (!isHost && !isPlayer) return sendJSON(res, 403, { error: 'not in this room' });

  meta = await maybeAdvance(meta);

  const inRound = meta.state === 'question' || meta.state === 'reveal';
  const guesses = inRound ? await store.hgetallJSON(guessesKey(code, meta.roundIdx)) : {};

  const out = {
    state: meta.state,
    mode: meta.mode || 'photo',
    roundIdx: meta.roundIdx,
    rounds: meta.rounds || ROUNDS,
    roundMs: meta.roundMs || ROUND_MS,
    roundStartAt: meta.roundStartAt,
    serverNow: Date.now(),
    locIdx: inRound ? meta.deck[meta.roundIdx] : null,
    players: Object.entries(players).map(([pid, p]) => ({
      id: pid,
      name: p.name,
      score: meta.state === 'question' ? undefined : p.score,
      answered: meta.state === 'question' ? Boolean(guesses[pid]) : undefined,
    })).sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.name.localeCompare(b.name)),
  };

  if (meta.state === 'reveal') {
    out.reveal = Object.entries(guesses).map(([pid, g]) => ({
      id: pid,
      name: players[pid]?.name || '?',
      lat: g.lat, lon: g.lon, km: g.km, pts: g.pts,
    }));
    if (isPlayer && guesses[playerId]) out.you = guesses[playerId];
  }
  sendJSON(res, 200, out);
};
