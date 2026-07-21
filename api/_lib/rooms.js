const crypto = require('crypto');
const LOCATIONS = require('../../shared/locations.js');
const { getStore } = require('./store.js');

const ROUNDS = 5;
const ROUND_MS = 45000;
const GRACE_MS = 2000;
const MAX_PLAYERS = 14;
const TTL_SEC = 4 * 3600;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const metaKey = (code) => `room:${code}`;
const playersKey = (code) => `room:${code}:players`;
const guessesKey = (code, round) => `room:${code}:g:${round}`;

function newCode() {
  let c = '';
  for (let i = 0; i < 4; i++) c += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return c;
}

function newDeck(rounds = ROUNDS) {
  const idx = [...LOCATIONS.keys()];
  for (let i = idx.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, rounds);
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const pointsFor = (km) => Math.round(5000 * Math.exp(-km / 2000));

async function loadRoom(code) {
  if (!/^[A-Z2-9]{4}$/.test(code || '')) return null;
  return getStore().getJSON(metaKey(code));
}

async function saveRoom(meta) {
  await getStore().setJSON(metaKey(meta.code), meta, TTL_SEC);
}

// Lazy transition: flip question -> reveal when time is up or everyone answered.
// Called from every state read; benign if two polls race (same outcome).
async function maybeAdvance(meta) {
  if (meta.state !== 'question') return meta;
  const store = getStore();
  const [players, guesses] = await Promise.all([
    store.hgetallJSON(playersKey(meta.code)),
    store.hgetallJSON(guessesKey(meta.code, meta.roundIdx)),
  ]);
  const everyoneAnswered = Object.keys(players).length > 0 &&
    Object.keys(players).every((pid) => guesses[pid]);
  const timeUp = Date.now() > meta.roundStartAt + (meta.roundMs || ROUND_MS) + GRACE_MS;
  if (everyoneAnswered || timeUp) {
    meta.state = 'reveal';
    await saveRoom(meta);
  }
  return meta;
}

function sendJSON(res, status, body) {
  res.status(status).json(body);
}

module.exports = {
  ROUNDS, ROUND_MS, GRACE_MS, MAX_PLAYERS, TTL_SEC, LOCATIONS,
  metaKey, playersKey, guessesKey,
  newCode, newDeck, haversineKm, pointsFor,
  loadRoom, saveRoom, maybeAdvance, sendJSON,
};
