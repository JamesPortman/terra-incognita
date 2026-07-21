// Admin actions, gated by the ADMIN_TOKEN env var (server-side check only).
const { getSql, ensureTable } = require('./_lib/db.js');
const { sendJSON } = require('./_lib/rooms.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method not allowed' });
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return sendJSON(res, 503, { error: 'admin is not configured' });
  if (req.body?.token !== expected) return sendJSON(res, 403, { error: 'wrong admin token' });

  if (req.body?.action === 'clearLeaderboard') {
    await ensureTable();
    await getSql()`DELETE FROM leaderboard`;
    return sendJSON(res, 200, { ok: true, cleared: true });
  }
  sendJSON(res, 400, { error: 'unknown action' });
};
