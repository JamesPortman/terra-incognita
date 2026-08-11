// Weekly deck determinism + the attempt flow with an E2E- name (which skips
// Neon entirely). The finish/leaderboard path needs the database and is
// covered by the Playwright weekly spec against `vercel dev`.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import weeklyLib from '../api/_lib/weekly.js';
import weekly from '../api/weekly.js';
import storeMod from '../api/_lib/store.js';
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
// unique IP per run so rate-limit counters in the persistent file store
// never accumulate across test runs
const RUN_IP = 'vitest-' + Math.random().toString(36).slice(2);
const call = async (method, body = {}, query = {}) => {
  const res = mockRes();
  await weekly({ method, body, query, headers: { 'x-forwarded-for': RUN_IP } }, res);
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

describe('weeklyMode', () => {
  it('flags 2026-W34 as random world, others famous', () => {
    expect(weeklyLib.weeklyMode('2026-W34')).toBe('random');
    expect(weeklyLib.weeklyMode('2026-W33')).toBe('famous');
    expect(weeklyLib.weeklyMode('2026-W35')).toBe('famous');
  });

  it('honors the WEEKLY_FORCE_MODE override', () => {
    process.env.WEEKLY_FORCE_MODE = 'famous';
    expect(weeklyLib.weeklyMode('2026-W34')).toBe('famous');
    delete process.env.WEEKLY_FORCE_MODE;
  });
});

describe('random-world weekly (forced mode, E2E- name, no database)', () => {
  const { getStore } = storeMod;
  const entry = (i) => ({ lat: 10 + i, lon: 20 + i, panoId: `pano-${i}`, label: `Spot ${i}` });
  const someDeck = () => Array.from({ length: WEEKLY_ROUNDS }, (_, i) => entry(i));

  beforeEach(async () => {
    process.env.WEEKLY_FORCE_MODE = 'random';
    await getStore().del('weeklydeck:' + isoWeek()); // fresh week per run
  });
  afterEach(() => { delete process.env.WEEKLY_FORCE_MODE; });

  it('asks the first player for a deck, stores it first-wins, and scores against it', async () => {
    const name = 'E2E-WkRand';
    expect((await call('POST', { action: 'start', name })).body.needDeck).toBe(true);
    expect((await call('POST', { action: 'start', name, deck: [entry(0)] })).code).toBe(400); // wrong length
    expect((await call('POST', { action: 'start', name, deck: someDeck().map((d, i) => i ? d : { ...d, lat: 91 }) })).code).toBe(400);

    const start = await call('POST', { action: 'start', name, deck: someDeck() });
    expect(start.code).toBe(200);
    expect(start.body.mode).toBe('random');
    expect(start.body.pano).toBe('pano-0'); // pano id only — no coordinates
    expect(start.body.locIdx).toBeUndefined();

    // a second player gets the stored deck even if they submit their own
    const other = await call('POST', { action: 'start', name: 'E2E-WkRand2',
      deck: someDeck().map((d) => ({ ...d, panoId: 'other-' + d.panoId })) });
    expect(other.body.pano).toBe('pano-0'); // first write won
    expect(other.body.needDeck).toBeUndefined();

    // perfect guess against the stored round-1 coordinates
    const g1 = await call('POST', { action: 'guess', name, token: start.body.token, lat: 10, lon: 20 });
    expect(g1.body.pts).toBe(5000);
    expect(g1.body.loc).toEqual({ lat: 10, lon: 20, label: 'Spot 0' }); // reveal only
    expect(g1.body.nextPano).toBe('pano-1');
    expect(g1.body.locIdx).toBeUndefined();

    const g2 = await call('POST', { action: 'guess', name, token: start.body.token, skip: true });
    expect(g2.body.pts).toBe(0);
    expect(g2.body.total).toBe(5000);
  });
});

describe('weekly attempt flow (E2E- name, no database)', () => {
  it('starts, scores server-side, and enforces the token', async () => {
    const name = 'E2E-WkUnit';
    const start = await call('POST', { action: 'start', name });
    expect(start.code).toBe(200);
    // only round 1 ships at start — later rounds arrive one per guess
    const deck = weeklyDeck(start.body.week);
    expect(start.body.deck).toBeUndefined();
    expect(start.body.locIdx).toBe(deck[0]);
    const { token } = start.body;

    expect((await call('POST', { action: 'guess', name, token: 'wrong', lat: 0, lon: 0 })).code).toBe(403);

    // perfect first guess
    const loc = LOCATIONS[deck[0]];
    const g1 = await call('POST', { action: 'guess', name, token, lat: loc.lat, lon: loc.lon });
    expect(g1.code).toBe(200);
    expect(g1.body.pts).toBe(5000);
    expect(g1.body.locIdx).toBe(deck[0]);
    expect(g1.body.nextLocIdx).toBe(deck[1]);
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
