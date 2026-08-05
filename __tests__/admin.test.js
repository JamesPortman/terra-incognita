// Auth paths only — the successful clear action touches Neon and is exercised
// manually / via the admin UI, never from unit tests.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import admin from '../api/admin.js';

function mockRes() {
  return {
    code: null,
    body: null,
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; },
  };
}

// unique IP per run so rate-limit counters in the persistent file store
// never accumulate across test runs
const RUN_IP = 'vitest-' + Math.random().toString(36).slice(2);

async function call(body, method = 'POST', ip = RUN_IP) {
  const res = mockRes();
  await admin({ method, body, headers: { 'x-forwarded-for': ip } }, res);
  return res;
}

describe('admin', () => {
  beforeEach(() => { process.env.ADMIN_TOKEN = 'test-secret'; });
  afterEach(() => { delete process.env.ADMIN_TOKEN; });

  it('rejects non-POST', async () => {
    expect((await call({}, 'GET')).code).toBe(405);
  });

  it('503s when no token is configured', async () => {
    delete process.env.ADMIN_TOKEN;
    expect((await call({ token: 'anything' })).code).toBe(503);
  });

  it('rejects a wrong or missing token', async () => {
    expect((await call({ token: 'wrong', action: 'clearLeaderboard' })).code).toBe(403);
    expect((await call({ action: 'clearLeaderboard' })).code).toBe(403);
  });

  it('rejects unknown actions even with the right token', async () => {
    expect((await call({ token: 'test-secret', action: 'dropEverything' })).code).toBe(400);
  });

  it('rate-limits repeated attempts from one IP', async () => {
    const ip = RUN_IP + '-brute';
    for (let i = 0; i < 20; i++) {
      expect((await call({ token: 'wrong' }, 'POST', ip)).code).toBe(403);
    }
    expect((await call({ token: 'wrong' }, 'POST', ip)).code).toBe(429);
    // even the right token is throttled once the window is exhausted
    expect((await call({ token: 'test-secret', action: 'dropEverything' }, 'POST', ip)).code).toBe(429);
  });
});
