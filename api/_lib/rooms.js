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

function newDeck(rounds = ROUNDS, pool = null) {
  const idx = pool ? [...pool] : [...LOCATIONS.keys()];
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

// Games longer than five rounds score only the best five.
const bestFiveTotal = (ptsList) =>
  [...ptsList].sort((a, b) => b - a).slice(0, 5).reduce((s, v) => s + v, 0);

async function loadRoom(code) {
  if (!/^[A-Z2-9]{4}$/.test(code || '')) return null;
  return getStore().getJSON(metaKey(code));
}

async function saveRoom(meta) {
  await getStore().setJSON(metaKey(meta.code), meta, TTL_SEC);
}

// Street View pano ids are opaque base64-ish tokens: letters, digits, and
// - _ . — Google pads user photosphere ids with a trailing dot, so a stricter
// pattern silently rejects real panoramas. Returns null when the entry is junk.
const PANO_ID = /^[\w.-]{1,128}$/;
function validDeckEntry(d) {
  const lat = Number(d?.lat), lon = Number(d?.lon);
  const panoId = String(d?.panoId || '');
  if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
      Math.abs(lat) > 90 || Math.abs(lon) > 180 || !PANO_ID.test(panoId)) return null;
  return {
    lat, lon, panoId,
    label: String(d?.label || '').slice(0, 80).replace(/[<>&"']/g, ''),
  };
}

// One finished round, shaped for the map replay stored on a leaderboard row.
// `loc` is a LOCATIONS entry or a custom-deck entry; `g` is the stored guess
// (absent when the player never pinned).
function roundDetail(loc, g) {
  const num = (v) => (Number.isFinite(v) ? v : null);
  return {
    lat: loc.lat,
    lon: loc.lon,
    label: loc.name || loc.label || '',
    glat: g ? num(g.lat) : null,
    glon: g ? num(g.lon) : null,
    km: g && g.km != null ? g.km : null,
    pts: g && g.pts ? g.pts : 0,
  };
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

// Errors carry a stable machine code next to the English text. The client
// localizes on the code (`api.<code>` in its MESSAGES table) and falls back to
// `error` for anything it doesn't recognize, so curl, older clients and the
// tests all keep reading the same English sentence they always did.
function fail(res, status, code, message, extra) {
  return sendJSON(res, status, { error: message, code, ...extra });
}

module.exports = {
  ROUNDS, ROUND_MS, GRACE_MS, MAX_PLAYERS, TTL_SEC, LOCATIONS,
  metaKey, playersKey, guessesKey,
  newCode, newDeck, haversineKm, pointsFor, bestFiveTotal, roundDetail, validDeckEntry,
  loadRoom, saveRoom, maybeAdvance, sendJSON, fail,
};
