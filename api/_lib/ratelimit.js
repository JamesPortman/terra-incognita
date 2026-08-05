// Fixed-window per-IP rate limiting over the KV store. Fails open: a store
// hiccup should never lock people out of the game.
const { getStore } = require('./store.js');
const { sendJSON } = require('./rooms.js');

function clientIp(req) {
  const fwd = req.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

// Returns true if the request may proceed. On deny, sends the 429 itself.
async function rateLimit(req, res, bucket, limit, windowSec) {
  const ip = clientIp(req);
  // `vercel dev` (local play + E2E) has no proxy header and hits the shared
  // production Redis — don't throttle it. Real Vercel traffic always carries
  // a platform-set x-forwarded-for, so this never opens up in production.
  if (LOOPBACK.has(ip) && !req.headers?.['x-forwarded-for']) return true;
  let n;
  try {
    const win = Math.floor(Date.now() / (windowSec * 1000));
    n = await getStore().incr(`rl:${bucket}:${ip}:${win}`, windowSec * 2);
  } catch {
    return true;
  }
  if (n > limit) {
    sendJSON(res, 429, { error: 'too many requests — slow down and try again shortly' });
    return false;
  }
  return true;
}

module.exports = { rateLimit, clientIp };
