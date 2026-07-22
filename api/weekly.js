// Weekly Expedition: server-scored solo attempt against the week's shared deck.
// GET            -> this week's board (+ your status when ?name= is given)
// POST start     -> begin an attempt (one per name per week; E2E-* replayable, never persisted)
// POST guess     -> score one round server-side; final guess writes weekly_scores
const crypto = require('crypto');
const { getStore } = require('./_lib/store.js');
const { getSql, ensureWeeklyTable } = require('./_lib/db.js');
const { haversineKm, pointsFor, sendJSON, LOCATIONS } = require('./_lib/rooms.js');
const { WEEKLY_ROUNDS, WEEKLY_ROUND_SEC, isoWeek, weeklyDeck, isTestName } = require('./_lib/weekly.js');

const GRACE_MS = 5000;
const ATTEMPT_TTL = 6 * 3600;
const attemptKey = (week, name) => `weekly:${week}:${name.toLowerCase()}`;

const cleanName = (raw) => String(raw || '').trim().slice(0, 20).replace(/[<>&"']/g, '');

async function topRows(week) {
  await ensureWeeklyTable();
  const rows = await getSql()`
    SELECT player_name, score, played_at FROM weekly_scores
    WHERE week = ${week}
    ORDER BY score DESC, played_at ASC
    LIMIT 20`;
  return rows.map((r) => ({ name: r.player_name, score: r.score, playedAt: r.played_at }));
}

module.exports = async (req, res) => {
  const week = isoWeek();
  const deck = weeklyDeck(week);

  if (req.method === 'GET') {
    const out = { week, rounds: WEEKLY_ROUNDS, roundSec: WEEKLY_ROUND_SEC, top: await topRows(week) };
    const name = cleanName(req.query?.name);
    if (name && !isTestName(name)) {
      const mine = out.top.find((r) => r.name.toLowerCase() === name.toLowerCase()) ||
        (await getSql()`SELECT score FROM weekly_scores WHERE week = ${week} AND lower(player_name) = ${name.toLowerCase()} LIMIT 1`)[0];
      out.played = Boolean(mine);
      if (mine) out.yourScore = mine.score;
    }
    return sendJSON(res, 200, out);
  }

  if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method not allowed' });
  const store = getStore();
  const name = cleanName(req.body?.name);
  if (!name) return sendJSON(res, 400, { error: 'name required' });

  if (req.body?.action === 'start') {
    if (!isTestName(name)) {
      await ensureWeeklyTable();
      const existing = await getSql()`
        SELECT score FROM weekly_scores WHERE week = ${week} AND lower(player_name) = ${name.toLowerCase()} LIMIT 1`;
      if (existing.length) {
        return sendJSON(res, 409, { error: 'already played this week', yourScore: existing[0].score });
      }
    }
    const attempt = {
      token: crypto.randomUUID(),
      name,
      roundIdx: 0,
      total: 0,
      results: [],
      roundStartAt: Date.now(),
    };
    await store.setJSON(attemptKey(week, name), attempt, ATTEMPT_TTL);
    return sendJSON(res, 200, {
      week, token: attempt.token, deck, rounds: WEEKLY_ROUNDS, roundSec: WEEKLY_ROUND_SEC,
    });
  }

  if (req.body?.action === 'guess') {
    const attempt = await store.getJSON(attemptKey(week, name));
    if (!attempt || attempt.token !== req.body?.token) return sendJSON(res, 403, { error: 'no active attempt' });
    if (attempt.roundIdx >= WEEKLY_ROUNDS) return sendJSON(res, 409, { error: 'attempt is finished' });

    const locIdx = deck[attempt.roundIdx];
    const loc = LOCATIONS[locIdx];
    const lat = Number(req.body?.lat), lon = Number(req.body?.lon);
    const hasPin = Number.isFinite(lat) && Number.isFinite(lon) &&
      Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !req.body?.skip;
    const late = Date.now() > attempt.roundStartAt + WEEKLY_ROUND_SEC * 1000 + GRACE_MS;

    let km = null, pts = 0;
    if (hasPin && !late) {
      km = haversineKm(lat, lon, loc.lat, loc.lon);
      pts = pointsFor(km);
    }
    attempt.results.push({ locIdx, km, pts });
    attempt.total += pts;
    attempt.roundIdx += 1;
    attempt.roundStartAt = Date.now();
    await store.setJSON(attemptKey(week, name), attempt, ATTEMPT_TTL);

    const out = { km, pts, locIdx, roundIdx: attempt.roundIdx, total: attempt.total };
    if (attempt.roundIdx >= WEEKLY_ROUNDS) {
      out.done = true;
      if (!isTestName(name)) {
        await ensureWeeklyTable();
        await getSql()`
          INSERT INTO weekly_scores (week, player_name, score, rounds)
          VALUES (${week}, ${name}, ${attempt.total}, ${WEEKLY_ROUNDS})
          ON CONFLICT (week, player_name) DO NOTHING`;
      }
      out.top = await topRows(week);
      out.rank = out.top.findIndex((r) => r.name.toLowerCase() === name.toLowerCase()) + 1 || null;
    }
    return sendJSON(res, 200, out);
  }

  sendJSON(res, 400, { error: 'unknown action' });
};
