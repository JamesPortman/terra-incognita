// Hall of fame query: each navigator appears once, at their personal best
// (optionally within one deck). Shared by /api/leaderboard and /api/solo.
const { getSql, ensureTable } = require('./db.js');

async function hallTop(deck /* full label, or null for all decks */) {
  await ensureTable();
  const sql = getSql();
  const rows = deck
    ? await sql`
        SELECT player_name, score, room_code, deck, played_at FROM (
          SELECT DISTINCT ON (lower(player_name))
            player_name, score, room_code, deck, played_at
          FROM leaderboard WHERE deck = ${deck}
          ORDER BY lower(player_name), score DESC, played_at ASC
        ) best ORDER BY score DESC, played_at ASC LIMIT 20`
    : await sql`
        SELECT player_name, score, room_code, deck, played_at FROM (
          SELECT DISTINCT ON (lower(player_name))
            player_name, score, room_code, deck, played_at
          FROM leaderboard
          ORDER BY lower(player_name), score DESC, played_at ASC
        ) best ORDER BY score DESC, played_at ASC LIMIT 20`;
  return rows.map((r) => ({
    name: r.player_name,
    score: r.score,
    room: r.room_code,
    deck: r.deck,
    playedAt: r.played_at,
  }));
}

module.exports = { hallTop };
