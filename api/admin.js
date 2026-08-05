// Admin actions, gated by the ADMIN_TOKEN env var (server-side check only).
const crypto = require('crypto');
const { getSql, ensureTable, ensureArchiveTable } = require('./_lib/db.js');
const { sendJSON } = require('./_lib/rooms.js');
const { rateLimit } = require('./_lib/ratelimit.js');

// hash both sides so timingSafeEqual gets equal-length buffers
const tokenMatches = (given, expected) => crypto.timingSafeEqual(
  crypto.createHash('sha256').update(String(given || '')).digest(),
  crypto.createHash('sha256').update(expected).digest(),
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method not allowed' });
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return sendJSON(res, 503, { error: 'admin is not configured' });
  if (!(await rateLimit(req, res, 'admin', 20, 3600))) return;
  if (!tokenMatches(req.body?.token, expected)) return sendJSON(res, 403, { error: 'wrong admin token' });

  if (req.body?.action === 'archiveSeason') {
    await ensureTable();
    await ensureArchiveTable();
    const now = new Date();
    const season = String(req.body?.season || `${now.getUTCFullYear()}-Q${Math.floor(now.getUTCMonth() / 3) + 1}`)
      .trim().slice(0, 20).replace(/[<>&"']/g, '');
    // single statement so a mid-flight failure can't leave rows in both tables
    const moved = await getSql()`
      WITH moved AS (DELETE FROM leaderboard RETURNING player_name, score, rounds, deck, played_at)
      INSERT INTO leaderboard_archive (season, player_name, score, rounds, deck, played_at)
      SELECT ${season}, player_name, score, rounds, deck, played_at FROM moved
      RETURNING id`;
    return sendJSON(res, 200, { ok: true, season, archived: moved.length });
  }

  if (req.body?.action === 'clearLeaderboard') {
    await ensureTable();
    await getSql()`DELETE FROM leaderboard`;
    return sendJSON(res, 200, { ok: true, cleared: true });
  }
  sendJSON(res, 400, { error: 'unknown action' });
};
