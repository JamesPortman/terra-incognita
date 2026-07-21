const crypto = require('crypto');
const { getStore } = require('./_lib/store.js');
const { loadRoom, playersKey, MAX_PLAYERS, TTL_SEC, sendJSON } = require('./_lib/rooms.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method not allowed' });
  const code = String(req.body?.code || '').toUpperCase().trim();
  let name = String(req.body?.name || '').trim().slice(0, 20).replace(/[<>&"']/g, '');
  if (!name) return sendJSON(res, 400, { error: 'name required' });

  const meta = await loadRoom(code);
  if (!meta) return sendJSON(res, 404, { error: 'room not found' });
  if (meta.state !== 'lobby') return sendJSON(res, 409, { error: 'game already started' });

  const store = getStore();
  const players = await store.hgetallJSON(playersKey(code));
  if (Object.keys(players).length >= MAX_PLAYERS) {
    return sendJSON(res, 409, { error: `room is full (max ${MAX_PLAYERS} players)` });
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
