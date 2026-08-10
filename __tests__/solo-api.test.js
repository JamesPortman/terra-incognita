// Recorded-solo attempt flow (random-world decks submitted by the client).
// The finish/leaderboard path needs Neon and is covered by the Playwright
// gmap spec against `vercel dev` — unit tests never fire the final guess
// (same precedent as weekly.test.js).
import { describe, it, expect } from 'vitest';
import solo from '../api/solo.js';

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

const entry = (i, extra = {}) => ({
  lat: 10 + i, lon: 20 + i, panoId: `pano-${i}`, label: `Spot ${i}`, ...extra,
});
const someDeck = (n) => Array.from({ length: n }, (_, i) => entry(i));
const start = (extra = {}) =>
  call('POST', { action: 'start', name: 'E2E-SoloUnit', deck: someDeck(3), ...extra });

describe('solo start', () => {
  it('accepts a valid random deck and returns a token', async () => {
    const res = await start();
    expect(res.code).toBe(200);
    expect(res.body.token).toMatch(/[0-9a-f-]{36}/);
    expect(res.body.rounds).toBe(3);
    expect(res.body.roundSec).toBe(60);
    expect(res.body.deck).toBeUndefined();
    expect(res.body.locIdx).toBeUndefined();
  });

  it('clamps round seconds server-side', async () => {
    expect((await start({ roundSec: 9999 })).body.roundSec).toBe(300);
    expect((await start({ roundSec: 5 })).body.roundSec).toBe(10);
  });

  it('rejects blank names, missing or oversized decks, and malformed entries', async () => {
    expect((await start({ name: '  ' })).code).toBe(400);
    expect((await start({ deck: undefined })).code).toBe(400);       // famous decks are casual-only
    expect((await start({ deck: [] })).code).toBe(400);
    expect((await start({ deck: someDeck(11) })).code).toBe(400);
    expect((await start({ deck: [entry(0, { lat: 91 })] })).code).toBe(400);
    expect((await start({ deck: [entry(0, { lon: 999 })] })).code).toBe(400);
    expect((await start({ deck: [entry(0, { panoId: 'has spaces!' })] })).code).toBe(400);
  });

  it('rejects non-POST and unknown actions', async () => {
    expect((await call('GET')).code).toBe(405);
    expect((await call('PUT', { action: 'start' })).code).toBe(405);
    expect((await call('POST', { action: 'dance' })).code).toBe(400);
  });
});

describe('solo guess (never finishing — the final write needs Neon)', () => {
  it('scores server-side against the submitted deck and enforces the token', async () => {
    const s = (await start()).body;
    expect((await call('POST', { action: 'guess', token: 'wrong', lat: 0, lon: 0 })).code).toBe(403);

    // perfect guess on the submitted round-1 coordinates
    const g1 = await call('POST', { action: 'guess', token: s.token, lat: 10, lon: 20 });
    expect(g1.code).toBe(200);
    expect(g1.body.pts).toBe(5000);
    expect(g1.body.km).toBe(0);
    expect(g1.body.roundIdx).toBe(1);
    expect(g1.body.locIdx).toBeUndefined(); // the client owns the deck

    const g2 = await call('POST', { action: 'guess', token: s.token, skip: true });
    expect(g2.body.pts).toBe(0);
    expect(g2.body.km).toBeNull();
    expect(g2.body.total).toBe(5000);
    expect(g2.body.done).toBeUndefined();
  });

  it('scores best five in longer games', async () => {
    const s = (await start({ deck: someDeck(6) })).body;
    const g1 = await call('POST', { action: 'guess', token: s.token, lat: 10, lon: 20 });
    expect(g1.body.total).toBe(5000);
    // a skipped round can't drag a best-five total down
    const g2 = await call('POST', { action: 'guess', token: s.token, skip: true });
    expect(g2.body.total).toBe(5000);
  });
});
