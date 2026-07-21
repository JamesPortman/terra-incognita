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

  // random-world rooms: the host's browser resolves panoramas (the Maps key is
  // referrer-locked, so lookups happen client-side) and submits the deck here.
  // Scoring still happens server-side against these stored coordinates.
  let customDeck = null;
  if (req.body?.deckType === 'random') {
    const raw = req.body?.deck;
    if (!Array.isArray(raw) || raw.length !== rounds) {
      return sendJSON(res, 400, { error: 'random deck must have one location per round' });
    }
    customDeck = [];
    for (const d of raw) {
      const lat = Number(d?.lat), lon = Number(d?.lon);
      const panoId = String(d?.panoId || '').slice(0, 64);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
          Math.abs(lat) > 90 || Math.abs(lon) > 180 || !/^[\w-]+$/.test(panoId)) {
        return sendJSON(res, 400, { error: 'invalid deck entry' });
      }
      customDeck.push({
        lat, lon, panoId,
        label: String(d?.label || '').slice(0, 80).replace(/[<>&"']/g, ''),
      });
    }
  }

  const meta = {
    code,
    state: 'lobby',
    mode: customDeck ? 'street' : (req.body?.mode === 'street' ? 'street' : 'photo'),
    roundMs: roundSec * 1000,
    rounds,
    roundIdx: -1,
    roundStartAt: 0,
    deck: newDeck(rounds),
    customDeck,
    hostToken: crypto.randomUUID(),
    createdAt: Date.now(),
    savedToLb: false,
  };
  await saveRoom(meta);
  sendJSON(res, 200, { code, hostToken: meta.hostToken, rounds, roundMs: meta.roundMs, mode: meta.mode });
};
