const { getSql, ensureTable, ensureArchiveTable } = require('./_lib/db.js');
const { sendJSON } = require('./_lib/rooms.js');

module.exports = async (req, res) => {
  await ensureTable();
  await ensureArchiveTable();
  const sql = getSql();
  const deck = typeof req.query?.deck === 'string' && req.query.deck ? req.query.deck.slice(0, 60) : null;
  // Hall of fame: each navigator appears once, at their personal best
  // (optionally within one deck).
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
  const seasons = await sql`
    SELECT DISTINCT ON (season) season, player_name, score
    FROM leaderboard_archive
    ORDER BY season DESC, score DESC, played_at ASC`;
  sendJSON(res, 200, {
    top: rows.map((r) => ({
      name: r.player_name,
      score: r.score,
      room: r.room_code,
      deck: r.deck,
      playedAt: r.played_at,
    })),
    pastSeasons: seasons.map((s) => ({ season: s.season, name: s.player_name, score: s.score })),
  });
};
