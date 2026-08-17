// Weekly Expedition: one shared, deterministic famous-places deck per ISO week.
// The deck is a pure function of the week string — no storage needed, and every
// player faces the same five locations.
const LOCATIONS = require('../../shared/locations.js');
const { DECKS } = require('../../shared/decks.js');

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

// Deterministic: same week -> same deck of location indices (World pool).
function weeklyDeck(week, rounds = WEEKLY_ROUNDS) {
  const rand = mulberry32(hashString('terra-' + week));
  const idx = [...DECKS.world];
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, rounds);
}

const isTestName = (name) => /^E2E-/i.test(name);

// Weeks that play Random world (Street View) instead of the famous-places
// deck. The first player of such a week resolves the panoramas client-side
// (the Maps key is referrer-locked) and the server stores them first-write-
// wins so everyone faces the same five. WEEKLY_FORCE_MODE overrides for
// tests and as an ops lever ('famous' | 'random').
const RANDOM_WEEKS = new Set(['2026-W34']);
const weeklyMode = (week) =>
  process.env.WEEKLY_FORCE_MODE || (RANDOM_WEEKS.has(week) ? 'random' : 'famous');

// Fold week-ordered score rows into per-week boards, newest first. Input must
// already be sorted (week DESC, score DESC); the caps keep the payload small.
function groupPastWeeks(rows, maxWeeks = 12, perWeek = 5) {
  const out = [];
  for (const r of rows) {
    let w = out[out.length - 1];
    if (!w || w.week !== r.week) {
      if (out.length >= maxWeeks) break;
      w = { week: r.week, top: [] };
      out.push(w);
    }
    if (w.top.length < perWeek) {
      w.top.push({
        id: r.id,
        name: r.player_name,
        score: r.score,
        awayMs: r.away_ms || 0,
        hasDetail: r.has_detail,
      });
    }
  }
  return out;
}

module.exports = {
  WEEKLY_ROUNDS, WEEKLY_ROUND_SEC, isoWeek, weeklyDeck, weeklyMode, isTestName, groupPastWeeks,
};
