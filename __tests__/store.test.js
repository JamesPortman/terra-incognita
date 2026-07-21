// Exercises the file-based dev store (the Redis implementation shares the same
// interface; its serialization contract is covered by the handler tests).
import { describe, it, expect } from 'vitest';
import storeMod from '../api/_lib/store.js';

const store = storeMod.getStore();
const uniq = () => 'test:' + Math.random().toString(36).slice(2);

describe('kv store', () => {
  it('set/get round-trips objects', async () => {
    const key = uniq();
    await store.setJSON(key, { a: 1, nested: { b: 'two' } }, 60);
    expect(await store.getJSON(key)).toEqual({ a: 1, nested: { b: 'two' } });
    await store.del(key);
  });

  it('returns null for missing keys and {} for missing hashes', async () => {
    expect(await store.getJSON(uniq())).toBeNull();
    expect(await store.hgetallJSON(uniq())).toEqual({});
  });

  it('hset/hgetall round-trips fields independently', async () => {
    const key = uniq();
    await store.hsetJSON(key, 'p1', { name: 'Alice', score: 10 });
    await store.hsetJSON(key, 'p2', { name: 'Bob', score: 20 });
    const all = await store.hgetallJSON(key);
    expect(Object.keys(all).sort()).toEqual(['p1', 'p2']);
    expect(all.p1.name).toBe('Alice');
    await store.del(key);
  });

  it('hsetnx refuses to overwrite an existing field', async () => {
    const key = uniq();
    expect(await store.hsetnxJSON(key, 'g', { pts: 100 })).toBe(true);
    expect(await store.hsetnxJSON(key, 'g', { pts: 999 })).toBe(false);
    expect((await store.hgetallJSON(key)).g.pts).toBe(100);
    await store.del(key);
  });
});
