const { getSql, ensureArchiveTable } = require('./_lib/db.js');
const { hallTop } = require('./_lib/hall.js');
const { sendJSON } = require('./_lib/rooms.js');

module.exports = async (req, res) => {
  await ensureArchiveTable();
  const deck = typeof req.query?.deck === 'string' && req.query.deck ? req.query.deck.slice(0, 60) : null;
  const top = await hallTop(deck, req.query?.source === 'solo'); // group games are the default board
  const seasons = await getSql()`
    SELECT DISTINCT ON (season) season, player_name, score
    FROM leaderboard_archive
    ORDER BY season DESC, score DESC, played_at ASC`;
  sendJSON(res, 200, {
    top,
    pastSeasons: seasons.map((s) => ({ season: s.season, name: s.player_name, score: s.score })),
  });
};
