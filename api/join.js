const crypto = require('crypto');
const { getStore } = require('./_lib/store.js');
const { loadRoom, playersKey, MAX_PLAYERS, TTL_SEC, sendJSON, fail } = require('./_lib/rooms.js');
const { rateLimit } = require('./_lib/ratelimit.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return fail(res, 405, 'method_not_allowed', 'method not allowed');
  if (!(await rateLimit(req, res, 'join', 60, 600))) return;
  const code = String(req.body?.code || '').toUpperCase().trim();
  let name = String(req.body?.name || '').trim().slice(0, 20).replace(/[<>&"']/g, '');
  if (!name) return fail(res, 400, 'name_required', 'name required');

  const meta = await loadRoom(code);
  if (!meta) return fail(res, 404, 'room_not_found', 'room not found');
  if (meta.state !== 'lobby') return fail(res, 409, 'game_started', 'game already started');

  const store = getStore();
  const players = await store.hgetallJSON(playersKey(code));
  if (Object.keys(players).length >= MAX_PLAYERS) {
    return fail(res, 409, 'room_full', `room is full (max ${MAX_PLAYERS} players)`, { args: [MAX_PLAYERS] });
  }
  const taken = new Set(Object.values(players).map((p) => p.name.toLowerCase()));
  let finalName = name, n = 2;
  while (taken.has(finalName.toLowerCase())) finalName = `${name} ${n++}`;

  const playerId = crypto.randomUUID().slice(0, 8);
  const token = crypto.randomUUID();
  await store.hsetJSON(playersKey(code), playerId, {
    name: finalName, token, score: 0, joinedAt: Date.now(),
  }, TTL_SEC);
  sendJSON(res, 200, { playerId, token, name: finalName });
};
