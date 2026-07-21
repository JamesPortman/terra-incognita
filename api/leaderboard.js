const { getSql, ensureTable } = require('./_lib/db.js');
const { sendJSON } = require('./_lib/rooms.js');

module.exports = async (req, res) => {
  await ensureTable();
  const rows = await getSql()`
    SELECT player_name, score, room_code, played_at
    FROM leaderboard
    ORDER BY score DESC, played_at ASC
    LIMIT 20`;
  sendJSON(res, 200, {
    top: rows.map((r) => ({
      name: r.player_name,
      score: r.score,
      room: r.room_code,
      playedAt: r.played_at,
    })),
  });
};
