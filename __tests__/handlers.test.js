// Handler-level tests: run the real api/ functions against the file-based dev
// store with mocked req/res. The final transition is only tested with zero
// players so no Neon write is attempted.
import { describe, it, expect } from 'vitest';
import create from '../api/create.js';
import join from '../api/join.js';
import guess from '../api/guess.js';
import next from '../api/next.js';
import state from '../api/state.js';
import LOCATIONS from '../shared/locations.js';

function mockRes() {
  return {
    code: null,
    body: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; },
  };
}

async function call(handler, { method = 'POST', body = {}, query = {} } = {}) {
  const res = mockRes();
  await handler({ method, body, query }, res);
  return res;
}

async function newRoom(extra = {}) {
  const res = await call(create, { body: extra });
  expect(res.code).toBe(200);
  return res.body;
}

async function joinAs(code, name) {
  const res = await call(join, { body: { code, name } });
  return res;
}

describe('create', () => {
  it('creates a lobby with defaults', async () => {
    const room = await newRoom();
    expect(room.code).toMatch(/^[A-Z2-9]{4}$/);
    expect(room.rounds).toBe(5);
    expect(room.roundMs).toBe(60000);
    expect(room.mode).toBe('photo');
  });

  it('honors street mode and clamps roundSec', async () => {
    expect((await newRoom({ mode: 'street', roundSec: 9999 })).roundMs).toBe(300000);
    expect((await newRoom({ roundSec: 3 })).roundMs).toBe(10000);
    expect((await newRoom({ mode: 'street' })).mode).toBe('street');
    expect((await newRoom({ mode: 'nonsense' })).mode).toBe('photo');
  });

  it('honors and clamps the round count', async () => {
    expect((await newRoom({ rounds: 3 })).rounds).toBe(3);
    expect((await newRoom({ rounds: 99 })).rounds).toBe(10);
    expect((await newRoom({ rounds: 0 })).rounds).toBe(5); // falsy -> default
    expect((await newRoom({})).rounds).toBe(5);
  });

  it('rejects GET', async () => {
    expect((await call(create, { method: 'GET' })).code).toBe(405);
  });
});

describe('join', () => {
  it('joins with a token and dedupes names', async () => {
    const { code } = await newRoom();
    const a = await joinAs(code, 'Alice');
    expect(a.code).toBe(200);
    expect(a.body.playerId).toBeTruthy();
    expect(a.body.token).toBeTruthy();
    const b = await joinAs(code, 'alice');
    expect(b.body.name).toBe('alice 2');
  });

  it('rejects unknown rooms, blank names, and joining mid-game', async () => {
    expect((await joinAs('ZZZZ', 'X')).code).toBe(404);
    const { code, hostToken } = await newRoom();
    expect((await joinAs(code, '   ')).code).toBe(400);
    await call(next, { body: { code, hostToken } });
    expect((await joinAs(code, 'Late')).code).toBe(409);
  });

  it('caps the room at 14 players', async () => {
    const { code } = await newRoom();
    for (let i = 0; i < 14; i++) expect((await joinAs(code, `P${i}`)).code).toBe(200);
    const overflow = await joinAs(code, 'P15');
    expect(overflow.code).toBe(409);
    expect(overflow.body.error).toMatch(/full/);
  });

  it('strips markup characters from names', async () => {
    const { code } = await newRoom();
    const r = await joinAs(code, '<script>alert(1)</script>');
    expect(r.body.name).not.toMatch(/[<>]/);
  });
});

describe('guess', () => {
  async function startedRoom() {
    const { code, hostToken } = await newRoom();
    const p = (await joinAs(code, 'Alice')).body;
    await call(next, { body: { code, hostToken } }); // lobby -> question
    return { code, hostToken, p };
  }

  it('scores server-side against the round location', async () => {
    const { code, hostToken, p } = await startedRoom();
    const st = await call(state, { method: 'GET', query: { code, hostToken } });
    const loc = LOCATIONS[st.body.locIdx];
    const r = await call(guess, {
      body: { code, playerId: p.playerId, token: p.token, lat: loc.lat, lon: loc.lon },
    });
    expect(r.code).toBe(200);
    const after = await call(state, { method: 'GET', query: { code, hostToken } });
    // sole player answered -> lazy transition to reveal with a perfect score
    expect(after.body.state).toBe('reveal');
    expect(after.body.reveal[0].pts).toBe(5000);
  });

  it('rejects double guesses, bad tokens, bad coords, and lobby guesses', async () => {
    const { code, hostToken, p } = await startedRoom();
    const ok = { code, playerId: p.playerId, token: p.token, lat: 10, lon: 10 };
    expect((await call(guess, { body: ok })).code).toBe(200);
    expect((await call(guess, { body: ok })).code).toBe(409);
    expect((await call(guess, { body: { ...ok, token: 'nope' } })).code).toBe(403);
    expect((await call(guess, { body: { ...ok, lat: 999 } })).code).toBe(400);
    const lobby = await newRoom();
    const q = (await joinAs(lobby.code, 'B')).body;
    expect((await call(guess, {
      body: { code: lobby.code, playerId: q.playerId, token: q.token, lat: 0, lon: 0 },
    })).code).toBe(409);
  });
});

describe('regional decks', () => {
  it('samples every round from the requested deck', async () => {
    const { DECKS } = await import('../shared/decks.js').then((m) => m.default || m);
    const { code, hostToken } = await newRoom({ deckId: 'sa', rounds: 5 });
    const pool = new Set(DECKS.sa);
    for (let r = 0; r < 5; r++) {
      await call(next, { body: { code, hostToken } }); // -> question
      const st = await call(state, { method: 'GET', query: { code, hostToken } });
      expect(pool.has(st.body.locIdx)).toBe(true);
      await call(next, { body: { code, hostToken } }); // -> reveal
    }
  });

  it('falls back to the world deck for unknown ids', async () => {
    const { DECKS } = await import('../shared/decks.js').then((m) => m.default || m);
    const { code, hostToken } = await newRoom({ deckId: 'mars' });
    await call(next, { body: { code, hostToken } });
    const st = await call(state, { method: 'GET', query: { code, hostToken } });
    expect(new Set(DECKS.world).has(st.body.locIdx)).toBe(true);
  });
});

describe('random-world custom decks', () => {
  const deck3 = [
    { lat: 48.85, lon: 2.35, panoId: 'abc123', label: 'Paris, France' },
    { lat: 35.68, lon: 139.7, panoId: 'def-456', label: 'Tokyo' },
    { lat: -33.86, lon: 151.2, panoId: 'ghi_789', label: 'Sydney' },
  ];

  it('accepts a valid deck and forces street mode', async () => {
    const room = await newRoom({ deckType: 'random', rounds: 3, deck: deck3 });
    expect(room.mode).toBe('street');
    expect(room.rounds).toBe(3);
  });

  it('rejects wrong lengths and malformed entries', async () => {
    expect((await call(create, { body: { deckType: 'random', rounds: 3, deck: deck3.slice(0, 2) } })).code).toBe(400);
    expect((await call(create, { body: {
      deckType: 'random', rounds: 1, deck: [{ lat: 999, lon: 0, panoId: 'x' }],
    } })).code).toBe(400);
    expect((await call(create, { body: {
      deckType: 'random', rounds: 1, deck: [{ lat: 0, lon: 0, panoId: 'bad pano!' }],
    } })).code).toBe(400);
  });

  it('sends pano id during questions, coords only at reveal, and scores server-side', async () => {
    const { code, hostToken } = await newRoom({ deckType: 'random', rounds: 3, deck: deck3 });
    const p = (await joinAs(code, 'Alice')).body;
    await call(next, { body: { code, hostToken } });

    const q = await call(state, { method: 'GET', query: { code, hostToken } });
    expect(q.body.pano).toEqual({ id: 'abc123' });
    expect(q.body.locIdx).toBeNull();
    expect(q.body.loc).toBeUndefined();

    const g = await call(guess, {
      body: { code, playerId: p.playerId, token: p.token, lat: 48.85, lon: 2.35 },
    });
    expect(g.code).toBe(200);

    const r = await call(state, { method: 'GET', query: { code, hostToken } });
    expect(r.body.state).toBe('reveal');
    expect(r.body.loc.lat).toBeCloseTo(48.85);
    expect(r.body.loc.label).toBe('Paris, France');
    expect(r.body.reveal[0].pts).toBe(5000);
  });

  it('strips markup from labels', async () => {
    const { code, hostToken } = await newRoom({
      deckType: 'random', rounds: 1,
      deck: [{ lat: 1, lon: 1, panoId: 'ok1', label: '<b>Spot</b>' }],
    });
    const p = (await joinAs(code, 'A')).body;
    await call(next, { body: { code, hostToken } });
    await call(guess, { body: { code, playerId: p.playerId, token: p.token, lat: 1, lon: 1 } });
    const r = await call(state, { method: 'GET', query: { code, hostToken } });
    expect(r.body.loc.label).not.toMatch(/[<>]/);
  });
});

describe('next / state machine', () => {
  it('requires the host token', async () => {
    const { code } = await newRoom();
    expect((await call(next, { body: { code, hostToken: 'wrong' } })).code).toBe(403);
  });

  it('walks lobby -> question -> reveal -> ... -> final (no players, no LB write)', async () => {
    const { code, hostToken } = await newRoom();
    const step = async () => (await call(next, { body: { code, hostToken } })).body;
    for (let round = 0; round < 5; round++) {
      expect(await step()).toEqual({ state: 'question', roundIdx: round });
      expect(await step()).toEqual({ state: 'reveal', roundIdx: round });
    }
    expect(await step()).toEqual({ state: 'final', roundIdx: 4 });
    expect((await call(next, { body: { code, hostToken } })).code).toBe(409);
  });

  it('a 2-round game reaches final after round 2', async () => {
    const { code, hostToken } = await newRoom({ rounds: 2 });
    const step = async () => (await call(next, { body: { code, hostToken } })).body;
    await step(); await step(); // q0, reveal0
    await step(); await step(); // q1, reveal1
    expect(await step()).toEqual({ state: 'final', roundIdx: 1 });
  });

  it('hides scores and answers during a question', async () => {
    const { code, hostToken } = await newRoom();
    const p = (await joinAs(code, 'Alice')).body;
    await call(next, { body: { code, hostToken } });
    const st = await call(state, { method: 'GET', query: { code, playerId: p.playerId, token: p.token } });
    expect(st.body.players[0].score).toBeUndefined();
    expect(st.body.players[0].answered).toBe(false);
    expect(st.body.reveal).toBeUndefined();
  });

  it('rejects state reads from strangers', async () => {
    const { code } = await newRoom();
    const st = await call(state, { method: 'GET', query: { code, playerId: 'x', token: 'y' } });
    expect(st.code).toBe(403);
  });
});
