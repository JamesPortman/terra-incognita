// Hall of fame query: each navigator appears once, at their personal best,
// optionally within one deck. Group games (live rooms) and solo games are
// separate boards — solo rows carry room_code 'SOLO'.
// Shared by /api/leaderboard and /api/solo.
const { getSql, ensureTable } = require('./db.js');

async function hallTop(deck /* full label, or null for all decks */, solo = false) {
  await ensureTable();
  const sql = getSql();
  // Solo games vary in length (1-10 rounds, best five counted), so the solo
  // board scores and ranks by average points per counted round. Group games
  // share a room's settings, so they rank by total.
  const rows = solo
    ? await sql`
        SELECT id, player_name, score, room_code, deck, played_at, has_detail FROM (
          SELECT DISTINCT ON (lower(player_name))
            id, player_name,
            round(score::numeric / LEAST(rounds, 5))::int AS score,
            room_code, deck, played_at, (detail IS NOT NULL) AS has_detail
          FROM leaderboard
          WHERE room_code = 'SOLO'
            AND (${deck}::text IS NULL OR deck = ${deck})
          ORDER BY lower(player_name), score::numeric / LEAST(rounds, 5) DESC, played_at ASC
        ) best ORDER BY score DESC, played_at ASC LIMIT 20`
    : await sql`
        SELECT id, player_name, score, room_code, deck, played_at, has_detail FROM (
          SELECT DISTINCT ON (lower(player_name))
            id, player_name, score, room_code, deck, played_at,
            (detail IS NOT NULL) AS has_detail
          FROM leaderboard
          WHERE room_code <> 'SOLO'
            AND (${deck}::text IS NULL OR deck = ${deck})
          ORDER BY lower(player_name), score DESC, played_at ASC
        ) best ORDER BY score DESC, played_at ASC LIMIT 20`;
  return rows.map((r) => ({
    id: r.id,
    name: r.player_name,
    score: r.score,
    room: r.room_code,
    deck: r.deck,
    playedAt: r.played_at,
    hasDetail: r.has_detail,
  }));
}

// One recorded game's round-by-round replay, for the map view.
async function gameDetail(id) {
  await ensureTable();
  const rows = await getSql()`
    SELECT player_name, score, rounds, deck, room_code, played_at, detail
    FROM leaderboard WHERE id = ${id}`;
  if (!rows.length) return null;
  const r = rows[0];
  return {
    name: r.player_name,
    score: r.score,
    rounds: r.rounds,
    deck: r.deck,
    solo: r.room_code === 'SOLO',
    playedAt: r.played_at,
    detail: r.detail || [],
  };
}

module.exports = { hallTop, gameDetail };
