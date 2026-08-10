// Recorded solo game: a server-scored attempt against a server-built deck,
// writing the all-time leaderboard (room_code 'SOLO') when it finishes.
// POST start -> begin an attempt (famous decks only; random world is
//               client-resolved and never eligible)
// POST guess -> score one round server-side; the final guess writes the row
const crypto = require('crypto');
const { getStore } = require('./_lib/store.js');
const { getSql, ensureTable } = require('./_lib/db.js');
const { haversineKm, pointsFor, bestFiveTotal, newDeck, sendJSON, LOCATIONS } = require('./_lib/rooms.js');
const { isTestName } = require('./_lib/weekly.js');
const { hallTop } = require('./_lib/hall.js');
const { rateLimit } = require('./_lib/ratelimit.js');
const { DECKS, DECK_LABELS } = require('../shared/decks.js');

const GRACE_MS = 5000;
const ATTEMPT_TTL = 6 * 3600;
const attemptKey = (token) => `solo:${token}`;

const cleanName = (raw) => String(raw || '').trim().slice(0, 20).replace(/[<>&"']/g, '');

// total is recomputed from results each guess so best-five is always right
const totalFor = (attempt) => attempt.rounds > 5
  ? bestFiveTotal(attempt.results.map((r) => r.pts))
  : attempt.results.reduce((s, r) => s + r.pts, 0);

async function finalPayload(attempt, last) {
  const label = DECK_LABELS[attempt.deckId];
  const top = await hallTop(label);
  return {
    km: last.km, pts: last.pts, locIdx: last.locIdx,
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
    const deckId = String(req.body?.deckId || '');
    if (!Object.hasOwn(DECKS, deckId) || deckId === 'random') {
      return sendJSON(res, 400, { error: 'deck not eligible for recorded games' });
    }
    const rounds = Math.min(10, Math.max(1, parseInt(req.body?.rounds, 10) || 5));
    const roundSec = Math.min(300, Math.max(10, parseInt(req.body?.roundSec, 10) || 60));
    const attempt = {
      token: crypto.randomUUID(),
      name,
      deckId,
      deck: newDeck(rounds, DECKS[deckId]), // server-shuffled — no cherry-picking
      rounds,
      roundSec,
      roundIdx: 0,
      results: [],
      awayMs: 0,
      roundStartAt: Date.now(),
    };
    await store.setJSON(attemptKey(attempt.token), attempt, ATTEMPT_TTL);
    // only the first round's location ships; the rest arrive one per guess
    return sendJSON(res, 200, { token: attempt.token, locIdx: attempt.deck[0], rounds, roundSec });
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

    const locIdx = attempt.deck[attempt.roundIdx];
    const loc = LOCATIONS[locIdx];
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
    attempt.results.push({ locIdx, km, pts });
    attempt.total = totalFor(attempt);
    attempt.roundIdx += 1;
    attempt.roundStartAt = Date.now();

    if (attempt.roundIdx < attempt.rounds) {
      await store.setJSON(attemptKey(token), attempt, ATTEMPT_TTL);
      return sendJSON(res, 200, {
        km, pts, locIdx, roundIdx: attempt.roundIdx, total: attempt.total,
        nextLocIdx: attempt.deck[attempt.roundIdx],
      });
    }

    // final round: flag + save BEFORE the insert (mirrors savedToLb ordering)
    // so a crash between the two can at worst drop a row, never double-write
    attempt.recorded = !isTestName(attempt.name);
    await store.setJSON(attemptKey(token), attempt, ATTEMPT_TTL);
    if (attempt.recorded) {
      await ensureTable();
      await getSql()`
        INSERT INTO leaderboard (room_code, player_name, score, rounds, deck)
        VALUES ('SOLO', ${attempt.name}, ${attempt.total}, ${attempt.rounds}, ${DECK_LABELS[attempt.deckId]})`;
    }
    return sendJSON(res, 200, await finalPayload(attempt, { km, pts, locIdx }));
  }

  sendJSON(res, 400, { error: 'unknown action' });
};
