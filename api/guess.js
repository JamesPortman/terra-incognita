const { getStore } = require('./_lib/store.js');
const {
  loadRoom, playersKey, guessesKey, haversineKm, pointsFor,
  LOCATIONS, ROUND_MS, GRACE_MS, TTL_SEC, sendJSON,
} = require('./_lib/rooms.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method not allowed' });
  const { code: rawCode, playerId, token } = req.body || {};
  const lat = Number(req.body?.lat), lon = Number(req.body?.lon);
  const code = String(rawCode || '').toUpperCase();
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return sendJSON(res, 400, { error: 'invalid coordinates' });
  }

  const meta = await loadRoom(code);
  if (!meta) return sendJSON(res, 404, { error: 'room not found' });
  if (meta.state !== 'question') return sendJSON(res, 409, { error: 'round is not open' });
  if (Date.now() > meta.roundStartAt + (meta.roundMs || ROUND_MS) + GRACE_MS) {
    return sendJSON(res, 409, { error: 'time is up' });
  }

  const store = getStore();
  const players = await store.hgetallJSON(playersKey(code));
  const player = players[playerId];
  if (!player || player.token !== token) return sendJSON(res, 403, { error: 'not in this room' });

  const loc = LOCATIONS[meta.deck[meta.roundIdx]];
  const km = haversineKm(lat, lon, loc.lat, loc.lon);
  const pts = pointsFor(km);
  const ms = Date.now() - meta.roundStartAt;

  const fresh = await store.hsetnxJSON(guessesKey(code, meta.roundIdx), playerId, { lat, lon, km, pts, ms }, TTL_SEC);
  if (!fresh) return sendJSON(res, 409, { error: 'already guessed this round' });

  player.score += pts;
  await store.hsetJSON(playersKey(code), playerId, player, TTL_SEC);
  sendJSON(res, 200, { ok: true });
};
