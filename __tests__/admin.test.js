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

async function call(body, method = 'POST') {
  const res = mockRes();
  await admin({ method, body }, res);
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
});
