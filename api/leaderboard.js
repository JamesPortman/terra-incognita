const { getSql, ensureArchiveTable } = require('./_lib/db.js');
const { hallTop, gameDetail } = require('./_lib/hall.js');
const { sendJSON, fail } = require('./_lib/rooms.js');

module.exports = async (req, res) => {
  // ?detail=<row id> — one game's round-by-round replay
  const detailId = parseInt(req.query?.detail, 10);
  if (Number.isFinite(detailId)) {
    const game = await gameDetail(detailId);
    if (!game) return fail(res, 404, 'game_not_found', 'game not found');
    return sendJSON(res, 200, game);
  }

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
