// Weekly deck determinism + the attempt flow with an E2E- name (which skips
// Neon entirely). The finish/leaderboard path needs the database and is
// covered by the Playwright weekly spec against `vercel dev`.
import { describe, it, expect } from 'vitest';
import weeklyLib from '../api/_lib/weekly.js';
import weekly from '../api/weekly.js';
import LOCATIONS from '../shared/locations.js';

const { isoWeek, weeklyDeck, WEEKLY_ROUNDS } = weeklyLib;

function mockRes() {
  return {
    code: null, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; },
  };
}
const call = async (method, body = {}, query = {}) => {
  const res = mockRes();
  await weekly({ method, body, query }, res);
  return res;
};

describe('isoWeek', () => {
  it('formats as YYYY-Www', () => {
    expect(isoWeek()).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('keeps Monday..Sunday in the same week and rolls over after', () => {
    const mon = isoWeek(new Date(Date.UTC(2026, 6, 20))); // Mon Jul 20 2026
    const sun = isoWeek(new Date(Date.UTC(2026, 6, 26))); // Sun Jul 26 2026
    const nextMon = isoWeek(new Date(Date.UTC(2026, 6, 27)));
    expect(mon).toBe(sun);
    expect(nextMon).not.toBe(mon);
  });
});

describe('weeklyDeck', () => {
  it('is deterministic per week and varies across weeks', () => {
    expect(weeklyDeck('2026-W30')).toEqual(weeklyDeck('2026-W30'));
    expect(weeklyDeck('2026-W30')).not.toEqual(weeklyDeck('2026-W31'));
  });

  it('picks unique in-range indices', () => {
    const deck = weeklyDeck('2026-W30');
    expect(deck).toHaveLength(WEEKLY_ROUNDS);
    expect(new Set(deck).size).toBe(WEEKLY_ROUNDS);
    for (const i of deck) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(LOCATIONS.length);
    }
  });
});

describe('weekly attempt flow (E2E- name, no database)', () => {
  it('starts, scores server-side, and enforces the token', async () => {
    const name = 'E2E-WkUnit';
    const start = await call('POST', { action: 'start', name });
    expect(start.code).toBe(200);
    expect(start.body.deck).toHaveLength(WEEKLY_ROUNDS);
    const { token, deck } = start.body;

    expect((await call('POST', { action: 'guess', name, token: 'wrong', lat: 0, lon: 0 })).code).toBe(403);

    // perfect first guess
    const loc = LOCATIONS[deck[0]];
    const g1 = await call('POST', { action: 'guess', name, token, lat: loc.lat, lon: loc.lon });
    expect(g1.code).toBe(200);
    expect(g1.body.pts).toBe(5000);
    expect(g1.body.locIdx).toBe(deck[0]);
    expect(g1.body.roundIdx).toBe(1);

    // a skipped round scores zero
    const g2 = await call('POST', { action: 'guess', name, token, skip: true });
    expect(g2.body.pts).toBe(0);
    expect(g2.body.km).toBeNull();
    expect(g2.body.total).toBe(5000);
  });

  it('rejects blank names and unknown actions', async () => {
    expect((await call('POST', { action: 'start', name: '  ' })).code).toBe(400);
    expect((await call('POST', { action: 'dance', name: 'E2E-X' })).code).toBe(400);
    expect((await call('PUT', { action: 'start', name: 'E2E-X' })).code).toBe(405);
  });
});
