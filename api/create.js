const crypto = require('crypto');
const { newCode, newDeck, saveRoom, loadRoom, ROUNDS, ROUND_MS, sendJSON } = require('./_lib/rooms.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method not allowed' });
  let code;
  for (let tries = 0; tries < 5; tries++) {
    code = newCode();
    if (!(await loadRoom(code))) break;
  }
  const roundSec = Math.min(300, Math.max(10, parseInt(req.body?.roundSec, 10) || 60));
  const rounds = Math.min(10, Math.max(1, parseInt(req.body?.rounds, 10) || 5));
  const meta = {
    code,
    state: 'lobby',
    mode: req.body?.mode === 'street' ? 'street' : 'photo',
    roundMs: roundSec * 1000,
    rounds,
    roundIdx: -1,
    roundStartAt: 0,
    deck: newDeck(rounds),
    hostToken: crypto.randomUUID(),
    createdAt: Date.now(),
    savedToLb: false,
  };
  await saveRoom(meta);
  sendJSON(res, 200, { code, hostToken: meta.hostToken, rounds, roundMs: meta.roundMs, mode: meta.mode });
};
