// KV abstraction over Upstash Redis. When Redis env vars are absent outside
// production (e.g. `vercel dev` before the integration is provisioned), falls
// back to a file-based store in the OS temp dir so the game is testable locally.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

function redisStore() {
  const { Redis } = require('@upstash/redis');
  const redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN, automaticDeserialization: false });
  return {
    async getJSON(key) {
      const v = await redis.get(key);
      return v == null ? null : JSON.parse(v);
    },
    async setJSON(key, val, ttlSec) {
      await redis.set(key, JSON.stringify(val), ttlSec ? { ex: ttlSec } : undefined);
    },
    async hsetJSON(key, field, val, ttlSec) {
      await redis.hset(key, { [field]: JSON.stringify(val) });
      if (ttlSec) await redis.expire(key, ttlSec);
    },
    // returns false (and writes nothing) if the field already exists
    async hsetnxJSON(key, field, val, ttlSec) {
      const set = await redis.hsetnx(key, field, JSON.stringify(val));
      if (ttlSec) await redis.expire(key, ttlSec);
      return set === 1;
    },
    async hgetallJSON(key) {
      const o = await redis.hgetall(key);
      const out = {};
      for (const [f, v] of Object.entries(o || {})) out[f] = typeof v === 'string' ? JSON.parse(v) : v;
      return out;
    },
    async del(...keys) { await redis.del(...keys); },
  };
}

function fileStore() {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const dir = path.join(os.tmpdir(), 'terra-dev-store');
  fs.mkdirSync(dir, { recursive: true });
  const fileFor = (key) => path.join(dir, encodeURIComponent(key) + '.json');
  const read = (key) => {
    try { return JSON.parse(fs.readFileSync(fileFor(key), 'utf8')); } catch { return null; }
  };
  const write = (key, val) => fs.writeFileSync(fileFor(key), JSON.stringify(val));
  return {
    async getJSON(key) { return read(key); },
    async setJSON(key, val) { write(key, val); },
    async hsetJSON(key, field, val) {
      const o = read(key) || {};
      o[field] = val;
      write(key, o);
    },
    async hsetnxJSON(key, field, val) {
      const o = read(key) || {};
      if (Object.prototype.hasOwnProperty.call(o, field)) return false;
      o[field] = val;
      write(key, o);
      return true;
    },
    async hgetallJSON(key) { return read(key) || {}; },
    async del(...keys) {
      const fs2 = require('fs');
      for (const k of keys) { try { fs2.unlinkSync(fileFor(k)); } catch {} }
    },
  };
}

let store;
if (REDIS_URL && REDIS_TOKEN) {
  store = redisStore();
} else if (process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview') {
  store = null; // fail loudly at call sites via getStore()
} else {
  console.warn('[store] Redis env vars missing — using file-based dev store');
  store = fileStore();
}

module.exports.getStore = function getStore() {
  if (!store) throw new Error('Redis is not provisioned (missing UPSTASH/KV env vars)');
  return store;
};
