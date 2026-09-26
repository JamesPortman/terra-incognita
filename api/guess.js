const { getStore } = require('./_lib/store.js');
const { tokenMatches, ownEntry } = require('./_lib/auth.js');
const {
  loadRoom, playersKey, guessesKey, haversineKm, pointsFor, bestFiveTotal,
  LOCATIONS, ROUND_MS, GRACE_MS, TTL_SEC, sendJSON, fail
} = require('./_lib/rooms.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return fail(res, 405, 'method_not_allowed', 'method not allowed');
  const { code: rawCode, playerId, token } = req.body || {};
  const lat = Number(req.body?.lat), lon = Number(req.body?.lon);
  const code = String(rawCode || '').toUpperCase();
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return fail(res, 400, 'invalid_coordinates', 'invalid coordinates');
  }

  const meta = await loadRoom(code);
  if (!meta) return fail(res, 404, 'room_not_found', 'room not found');
  if (meta.state !== 'question') return fail(res, 409, 'round_not_open', 'round is not open');
  if (Date.now() > meta.roundStartAt + (meta.roundMs || ROUND_MS) + GRACE_MS) {
    return fail(res, 409, 'time_up', 'time is up');
  }

  const store = getStore();
  const players = await store.hgetallJSON(playersKey(code));
  // own-property lookup: `constructor`/`__proto__` must not resolve to
  // Object.prototype (whose .token is undefined) — and every write below is
  // keyed by this playerId, so it is a real joined player from here on
  const player = ownEntry(players, playerId);
  if (!player || !tokenMatches(token, player.token)) return fail(res, 403, 'not_in_room', 'not in this room');

  const loc = meta.customDeck ? meta.customDeck[meta.roundIdx] : LOCATIONS[meta.deck[meta.roundIdx]];
  const km = haversineKm(lat, lon, loc.lat, loc.lon);
  const pts = pointsFor(km);
  const ms = Date.now() - meta.roundStartAt;
  const awayMs = Math.min(600000, Math.max(0, Math.round(Number(req.body?.awayMs) || 0)));

  const fresh = await store.hsetnxJSON(guessesKey(code, meta.roundIdx), playerId, { lat, lon, km, pts, ms, awayMs }, TTL_SEC);
  if (!fresh) return fail(res, 409, 'already_guessed', 'already guessed this round');

  player.ptsByRound = { ...(player.ptsByRound || {}), [meta.roundIdx]: pts };
  player.score = bestFiveTotal(Object.values(player.ptsByRound));
  await store.hsetJSON(playersKey(code), playerId, player, TTL_SEC);
  sendJSON(res, 200, { ok: true });
};
