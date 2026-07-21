const crypto = require('crypto');
const { newCode, newDeck, saveRoom, loadRoom, ROUNDS, ROUND_MS, sendJSON } = require('./_lib/rooms.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method not allowed' });
  let code;
  for (let tries = 0; tries < 5; tries++) {
    code = newCode();
    if (!(await loadRoom(code))) break;
  }
  const meta = {
    code,
    state: 'lobby',
    roundIdx: -1,
    roundStartAt: 0,
    deck: newDeck(),
    hostToken: crypto.randomUUID(),
    createdAt: Date.now(),
    savedToLb: false,
  };
  await saveRoom(meta);
  sendJSON(res, 200, { code, hostToken: meta.hostToken, rounds: ROUNDS, roundMs: ROUND_MS });
};
