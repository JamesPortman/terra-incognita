// Weekly Expedition: server-scored solo attempt against the week's shared deck.
// GET            -> this week's board (+ your status when ?name= is given)
// POST start     -> begin an attempt (one per name per week; E2E-* replayable, never persisted)
// POST guess     -> score one round server-side; final guess writes weekly_scores
const crypto = require('crypto');
const { getStore } = require('./_lib/store.js');
const { getSql, ensureWeeklyTable } = require('./_lib/db.js');
const { haversineKm, pointsFor, roundDetail, sendJSON, LOCATIONS } = require('./_lib/rooms.js');
const {
  WEEKLY_ROUNDS, WEEKLY_ROUND_SEC, isoWeek, weeklyDeck, weeklyMode, isTestName, groupPastWeeks,
} = require('./_lib/weekly.js');
const { rateLimit } = require('./_lib/ratelimit.js');

const GRACE_MS = 5000;
const ATTEMPT_TTL = 6 * 3600;
const RANDOM_DECK_TTL = 14 * 86400; // outlives the week comfortably
const attemptKey = (week, name) => `weekly:${week}:${name.toLowerCase()}`;
const randomDeckKey = (week) => `weeklydeck:${week}`;

// same validation as random-room hosting in create.js
function validateRandomDeck(raw) {
  if (!Array.isArray(raw) || raw.length !== WEEKLY_ROUNDS) return null;
  const deck = [];
  for (const d of raw) {
    const lat = Number(d?.lat), lon = Number(d?.lon);
    const panoId = String(d?.panoId || '').slice(0, 64);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
        Math.abs(lat) > 90 || Math.abs(lon) > 180 || !/^[\w-]+$/.test(panoId)) {
      return null;
    }
    deck.push({
      lat, lon, panoId,
      label: String(d?.label || '').slice(0, 80).replace(/[<>&"']/g, ''),
    });
  }
  return deck;
}

const cleanName = (raw) => String(raw || '').trim().slice(0, 20).replace(/[<>&"']/g, '');

async function topRows(week) {
  await ensureWeeklyTable();
  const rows = await getSql()`
    SELECT id, player_name, score, away_ms, played_at, (detail IS NOT NULL) AS has_detail
    FROM weekly_scores
    WHERE week = ${week}
    ORDER BY score DESC, played_at ASC
    LIMIT 20`;
  return rows.map((r) => ({
    id: r.id, name: r.player_name, score: r.score,
    awayMs: r.away_ms || 0, playedAt: r.played_at, hasDetail: r.has_detail,
  }));
}

// finished weeks, most recent first: up to 12 weeks, top 5 each
async function pastWeeks(current) {
  await ensureWeeklyTable();
  const rows = await getSql()`
    SELECT id, week, player_name, score, away_ms, (detail IS NOT NULL) AS has_detail
    FROM weekly_scores
    WHERE week <> ${current}
    ORDER BY week DESC, score DESC, played_at ASC
    LIMIT 500`;
  return groupPastWeeks(rows);
}

module.exports = async (req, res) => {
  const week = isoWeek();
  const mode = weeklyMode(week);
  const deck = weeklyDeck(week); // famous-mode deck (locIdx list); unused in random weeks

  if (req.method === 'GET') {
    // ?detail=<row id> — one attempt's round-by-round replay
    const detailId = parseInt(req.query?.detail, 10);
    if (Number.isFinite(detailId)) {
      await ensureWeeklyTable();
      const rows = await getSql()`
        SELECT week, player_name, score, rounds, played_at, detail
        FROM weekly_scores WHERE id = ${detailId}`;
      if (!rows.length) return sendJSON(res, 404, { error: 'game not found' });
      const r = rows[0];
      return sendJSON(res, 200, {
        name: r.player_name, score: r.score, rounds: r.rounds,
        week: r.week, playedAt: r.played_at, detail: r.detail || [],
      });
    }

    const out = {
      week, mode, rounds: WEEKLY_ROUNDS, roundSec: WEEKLY_ROUND_SEC,
      top: await topRows(week),
      past: await pastWeeks(week),
    };
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
    if (!(await rateLimit(req, res, 'weekly', 20, 600))) return;
    if (!isTestName(name)) {
      await ensureWeeklyTable();
      const existing = await getSql()`
        SELECT score FROM weekly_scores WHERE week = ${week} AND lower(player_name) = ${name.toLowerCase()} LIMIT 1`;
      if (existing.length) {
        return sendJSON(res, 409, { error: 'already played this week', yourScore: existing[0].score });
      }
    }
    // random weeks play a stored panorama deck; the first player's browser
    // resolves it (referrer-locked Maps key) and submits it here, first wins
    let randomDeck = null;
    if (mode === 'random') {
      randomDeck = await store.getJSON(randomDeckKey(week));
      if (!randomDeck) {
        if (req.body?.deck === undefined) return sendJSON(res, 200, { week, mode, needDeck: true });
        const submitted = validateRandomDeck(req.body.deck);
        if (!submitted) return sendJSON(res, 400, { error: 'invalid weekly deck' });
        await store.setJSONnx(randomDeckKey(week), submitted, RANDOM_DECK_TTL);
        randomDeck = await store.getJSON(randomDeckKey(week)); // a racer may have won
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
    // only the first round ships — the rest arrive one per guess, so the
    // console can't preview upcoming rounds (random weeks get a pano id
    // only; its coordinates would leak the answer)
    return sendJSON(res, 200, {
      week, mode, token: attempt.token, rounds: WEEKLY_ROUNDS, roundSec: WEEKLY_ROUND_SEC,
      ...(mode === 'random' ? { pano: randomDeck[0].panoId } : { locIdx: deck[0] }),
    });
  }

  if (req.body?.action === 'guess') {
    const attempt = await store.getJSON(attemptKey(week, name));
    if (!attempt || attempt.token !== req.body?.token) return sendJSON(res, 403, { error: 'no active attempt' });
    if (attempt.roundIdx >= WEEKLY_ROUNDS) return sendJSON(res, 409, { error: 'attempt is finished' });

    let locIdx = null, randomDeck = null, loc;
    if (mode === 'random') {
      randomDeck = await store.getJSON(randomDeckKey(week));
      if (!randomDeck) return sendJSON(res, 409, { error: 'this week\'s deck is missing' });
      loc = randomDeck[attempt.roundIdx];
    } else {
      locIdx = deck[attempt.roundIdx];
      loc = LOCATIONS[locIdx];
    }
    const lat = Number(req.body?.lat), lon = Number(req.body?.lon);
    const hasPin = Number.isFinite(lat) && Number.isFinite(lon) &&
      Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !req.body?.skip;
    const late = Date.now() > attempt.roundStartAt + WEEKLY_ROUND_SEC * 1000 + GRACE_MS;

    let km = null, pts = 0;
    if (hasPin && !late) {
      km = haversineKm(lat, lon, loc.lat, loc.lon);
      pts = pointsFor(km);
    }
    attempt.awayMs = (attempt.awayMs || 0) +
      Math.min(600000, Math.max(0, Math.round(Number(req.body?.awayMs) || 0)));
    // a late pin still scores zero but is worth keeping for the map replay
    attempt.results.push(roundDetail(loc, hasPin ? { lat, lon, km, pts } : null));
    attempt.total += pts;
    attempt.roundIdx += 1;
    attempt.roundStartAt = Date.now();
    await store.setJSON(attemptKey(week, name), attempt, ATTEMPT_TTL);

    const out = { km, pts, roundIdx: attempt.roundIdx, total: attempt.total };
    if (mode === 'random') {
      // coordinates and label only appear at reveal, next round is pano-only
      out.loc = { lat: loc.lat, lon: loc.lon, label: loc.label || '' };
      if (attempt.roundIdx < WEEKLY_ROUNDS) out.nextPano = randomDeck[attempt.roundIdx].panoId;
    } else {
      out.locIdx = locIdx;
      if (attempt.roundIdx < WEEKLY_ROUNDS) out.nextLocIdx = deck[attempt.roundIdx];
    }
    if (attempt.roundIdx >= WEEKLY_ROUNDS) {
      out.done = true;
      if (!isTestName(name)) {
        await ensureWeeklyTable();
        await getSql()`
          INSERT INTO weekly_scores (week, player_name, score, rounds, away_ms, detail)
          VALUES (${week}, ${name}, ${attempt.total}, ${WEEKLY_ROUNDS}, ${attempt.awayMs || 0},
                  ${JSON.stringify(attempt.results)}::jsonb)
          ON CONFLICT (week, player_name) DO NOTHING`;
      }
      out.top = await topRows(week);
      out.rank = out.top.findIndex((r) => r.name.toLowerCase() === name.toLowerCase()) + 1 || null;
    }
    return sendJSON(res, 200, out);
  }

  sendJSON(res, 400, { error: 'unknown action' });
};
