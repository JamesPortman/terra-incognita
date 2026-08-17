// Recorded solo game: a server-scored attempt against a client-resolved
// Random world (Street View) deck, writing the all-time leaderboard
// (room_code 'SOLO') when it finishes. Famous-deck solo is casual-only.
// The client resolves the panoramas (the Maps key is referrer-locked) and
// submits the deck at start — same trust model as hosting a random room.
// The server validates it and enforces timing, no rewrites, and scoring.
// POST start -> begin an attempt with a submitted random deck
// POST guess -> score one round server-side; the final guess writes the row
const crypto = require('crypto');
const { getStore } = require('./_lib/store.js');
const { getSql, ensureTable } = require('./_lib/db.js');
const { haversineKm, pointsFor, bestFiveTotal, roundDetail, sendJSON } = require('./_lib/rooms.js');
const { isTestName } = require('./_lib/weekly.js');
const { hallTop } = require('./_lib/hall.js');
const { rateLimit } = require('./_lib/ratelimit.js');
const { DECK_LABELS } = require('../shared/decks.js');

const GRACE_MS = 5000;
const ATTEMPT_TTL = 6 * 3600;
const attemptKey = (token) => `solo:${token}`;

const cleanName = (raw) => String(raw || '').trim().slice(0, 20).replace(/[<>&"']/g, '');

// total is recomputed from results each guess so best-five is always right
const totalFor = (attempt) => attempt.rounds > 5
  ? bestFiveTotal(attempt.results.map((r) => r.pts))
  : attempt.results.reduce((s, r) => s + r.pts, 0);

async function finalPayload(attempt, last) {
  const top = await hallTop(DECK_LABELS.random, true); // rank within the solo board
  return {
    km: last.km, pts: last.pts,
    roundIdx: attempt.rounds, total: attempt.total,
    done: true, recorded: Boolean(attempt.recorded),
    top,
    rank: top.findIndex((r) => r.name.toLowerCase() === attempt.name.toLowerCase()) + 1 || null,
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method not allowed' });
  const store = getStore();

  if (req.body?.action === 'start') {
    if (!(await rateLimit(req, res, 'solo', 30, 600))) return;
    const name = cleanName(req.body?.name);
    if (!name) return sendJSON(res, 400, { error: 'name required' });
    const raw = req.body?.deck;
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 10) {
      return sendJSON(res, 400, { error: 'recorded solo needs a random deck of 1-10 locations' });
    }
    // same validation as random-room hosting in create.js
    const customDeck = [];
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
    const roundSec = Math.min(300, Math.max(10, parseInt(req.body?.roundSec, 10) || 60));
    const attempt = {
      token: crypto.randomUUID(),
      name,
      customDeck,
      rounds: customDeck.length,
      roundSec,
      roundIdx: 0,
      results: [],
      awayMs: 0,
      roundStartAt: Date.now(),
    };
    await store.setJSON(attemptKey(attempt.token), attempt, ATTEMPT_TTL);
    return sendJSON(res, 200, { token: attempt.token, rounds: attempt.rounds, roundSec });
  }

  if (req.body?.action === 'guess') {
    const token = String(req.body?.token || '');
    const attempt = token ? await store.getJSON(attemptKey(token)) : null;
    if (!attempt) return sendJSON(res, 403, { error: 'no active attempt' });

    if (attempt.roundIdx >= attempt.rounds) {
      // finished attempt: replay the final payload so a network retry after
      // the row was written is safe (idempotent, unlike weekly's 409)
      return sendJSON(res, 200, await finalPayload(attempt, attempt.results[attempt.results.length - 1]));
    }

    const loc = attempt.customDeck[attempt.roundIdx];
    const lat = Number(req.body?.lat), lon = Number(req.body?.lon);
    const hasPin = Number.isFinite(lat) && Number.isFinite(lon) &&
      Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !req.body?.skip;
    const late = Date.now() > attempt.roundStartAt + attempt.roundSec * 1000 + GRACE_MS;

    let km = null, pts = 0;
    if (hasPin && !late) {
      km = haversineKm(lat, lon, loc.lat, loc.lon);
      pts = pointsFor(km);
    }
    attempt.awayMs = (attempt.awayMs || 0) +
      Math.min(600000, Math.max(0, Math.round(Number(req.body?.awayMs) || 0)));
    // a late pin still scores zero but is worth keeping for the map replay
    attempt.results.push(roundDetail(loc, hasPin ? { lat, lon, km, pts } : null));
    attempt.total = totalFor(attempt);
    attempt.roundIdx += 1;
    attempt.roundStartAt = Date.now();

    if (attempt.roundIdx < attempt.rounds) {
      await store.setJSON(attemptKey(token), attempt, ATTEMPT_TTL);
      return sendJSON(res, 200, { km, pts, roundIdx: attempt.roundIdx, total: attempt.total });
    }

    // final round: flag + save BEFORE the insert (mirrors savedToLb ordering)
    // so a crash between the two can at worst drop a row, never double-write
    attempt.recorded = !isTestName(attempt.name);
    await store.setJSON(attemptKey(token), attempt, ATTEMPT_TTL);
    if (attempt.recorded) {
      await ensureTable();
      await getSql()`
        INSERT INTO leaderboard (room_code, player_name, score, rounds, deck, detail)
        VALUES ('SOLO', ${attempt.name}, ${attempt.total}, ${attempt.rounds}, ${DECK_LABELS.random},
                ${JSON.stringify(attempt.results)}::jsonb)`;
    }
    return sendJSON(res, 200, await finalPayload(attempt, { km, pts }));
  }

  sendJSON(res, 400, { error: 'unknown action' });
};
