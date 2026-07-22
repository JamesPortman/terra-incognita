// Weekly Expedition: one shared, deterministic famous-places deck per ISO week.
// The deck is a pure function of the week string — no storage needed, and every
// player faces the same five locations.
const LOCATIONS = require('../../shared/locations.js');

const WEEKLY_ROUNDS = 5;
const WEEKLY_ROUND_SEC = 60;

// ISO-8601 week (UTC): "2026-W30"
function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // Thursday decides the year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic: same week -> same deck of location indices.
function weeklyDeck(week, rounds = WEEKLY_ROUNDS) {
  const rand = mulberry32(hashString('terra-' + week));
  const idx = [...LOCATIONS.keys()];
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, rounds);
}

const isTestName = (name) => /^E2E-/i.test(name);

module.exports = { WEEKLY_ROUNDS, WEEKLY_ROUND_SEC, isoWeek, weeklyDeck, isTestName };
