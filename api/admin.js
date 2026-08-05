// Admin actions, gated by the ADMIN_TOKEN env var (server-side check only).
const { getSql, ensureTable } = require('./_lib/db.js');
const { sendJSON } = require('./_lib/rooms.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method not allowed' });
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return sendJSON(res, 503, { error: 'admin is not configured' });
  if (req.body?.token !== expected) return sendJSON(res, 403, { error: 'wrong admin token' });

  if (req.body?.action === 'archiveSeason') {
    const { ensureArchiveTable } = require('./_lib/db.js');
    await ensureTable();
    await ensureArchiveTable();
    const now = new Date();
    const season = String(req.body?.season || `${now.getUTCFullYear()}-Q${Math.floor(now.getUTCMonth() / 3) + 1}`)
      .trim().slice(0, 20).replace(/[<>&"']/g, '');
    const sql = getSql();
    const moved = await sql`
      INSERT INTO leaderboard_archive (season, player_name, score, rounds, deck, played_at)
      SELECT ${season}, player_name, score, rounds, deck, played_at FROM leaderboard
      RETURNING id`;
    await sql`DELETE FROM leaderboard`;
    return sendJSON(res, 200, { ok: true, season, archived: moved.length });
  }

  if (req.body?.action === 'clearLeaderboard') {
    await ensureTable();
    await getSql()`DELETE FROM leaderboard`;
    return sendJSON(res, 200, { ok: true, cleared: true });
  }
  sendJSON(res, 400, { error: 'unknown action' });
};
