// Recorded-solo attempt flow. The finish/leaderboard path needs Neon and is
// covered by the Playwright solo spec against `vercel dev` — unit tests never
// fire the final guess (same precedent as weekly.test.js).
import { describe, it, expect } from 'vitest';
import solo from '../api/solo.js';
import decksMod from '../shared/decks.js';
import LOCATIONS from '../shared/locations.js';

const { DECKS } = decksMod;

function mockRes() {
  return {
    code: null, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; },
  };
}

// unique IP per run so rate-limit counters in the persistent file store
// never accumulate across test runs
const RUN_IP = 'vitest-' + Math.random().toString(36).slice(2);
const call = async (method, body = {}) => {
  const res = mockRes();
  await solo({ method, body, headers: { 'x-forwarded-for': RUN_IP } }, res);
  return res;
};

const start = (extra = {}) =>
  call('POST', { action: 'start', name: 'E2E-SoloUnit', deckId: 'na', ...extra });

describe('solo start', () => {
  it('returns a token and only the first location', async () => {
    const res = await start();
    expect(res.code).toBe(200);
    expect(res.body.token).toMatch(/[0-9a-f-]{36}/);
    expect(res.body.rounds).toBe(5);
    expect(res.body.roundSec).toBe(60);
    expect(DECKS.na).toContain(res.body.locIdx);
    expect(res.body.deck).toBeUndefined(); // future rounds never leak
  });

  it('clamps rounds and round seconds server-side', async () => {
    expect((await start({ rounds: 99, roundSec: 9999 })).body).toMatchObject({ rounds: 10, roundSec: 300 });
    expect((await start({ rounds: -3, roundSec: 5 })).body).toMatchObject({ rounds: 1, roundSec: 10 });
    expect((await start({ rounds: 0 })).body).toMatchObject({ rounds: 5 }); // falsy -> default, like create.js
  });

  it('rejects blank names and ineligible decks', async () => {
    expect((await start({ name: '  ' })).code).toBe(400);
    expect((await start({ deckId: 'random' })).code).toBe(400);
    expect((await start({ deckId: 'nope' })).code).toBe(400);
    expect((await start({ deckId: '__proto__' })).code).toBe(400);
  });

  it('rejects non-POST and unknown actions', async () => {
    expect((await call('GET')).code).toBe(405);
    expect((await call('PUT', { action: 'start' })).code).toBe(405);
    expect((await call('POST', { action: 'dance' })).code).toBe(400);
  });
});

describe('solo guess (never finishing — the final write needs Neon)', () => {
  it('scores server-side, enforces the token, discloses one round at a time', async () => {
    const s = (await start({ rounds: 3 })).body;
    expect((await call('POST', { action: 'guess', token: 'wrong', lat: 0, lon: 0 })).code).toBe(403);

    const loc1 = LOCATIONS[s.locIdx];
    const g1 = await call('POST', { action: 'guess', token: s.token, lat: loc1.lat, lon: loc1.lon });
    expect(g1.code).toBe(200);
    expect(g1.body.pts).toBe(5000);
    expect(g1.body.locIdx).toBe(s.locIdx);
    expect(g1.body.roundIdx).toBe(1);
    expect(g1.body.nextLocIdx).not.toBe(s.locIdx);
    expect(DECKS.na).toContain(g1.body.nextLocIdx);

    const g2 = await call('POST', { action: 'guess', token: s.token, skip: true });
    expect(g2.body.pts).toBe(0);
    expect(g2.body.km).toBeNull();
    expect(g2.body.total).toBe(5000);
    expect(g2.body.done).toBeUndefined();
  });

  it('scores best five in longer games', async () => {
    const s = (await start({ rounds: 6 })).body;
    const loc1 = LOCATIONS[s.locIdx];
    const g1 = await call('POST', { action: 'guess', token: s.token, lat: loc1.lat, lon: loc1.lon });
    expect(g1.body.total).toBe(5000);
    // a skipped round can't drag a best-five total down
    const g2 = await call('POST', { action: 'guess', token: s.token, skip: true });
    expect(g2.body.total).toBe(5000);
  });
});
