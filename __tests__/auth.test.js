import { describe, it, expect } from 'vitest';
import auth from '../api/_lib/auth.js';

const { tokenMatches, ownEntry } = auth;

describe('tokenMatches', () => {
  it('matches equal non-empty strings', () => {
    expect(tokenMatches('abc-123', 'abc-123')).toBe(true);
  });

  it('rejects different tokens, including different lengths', () => {
    expect(tokenMatches('abc', 'abd')).toBe(false);
    expect(tokenMatches('abc', 'abcd')).toBe(false);
  });

  it('never matches missing, empty or non-string values', () => {
    expect(tokenMatches(undefined, undefined)).toBe(false);
    expect(tokenMatches('', '')).toBe(false);
    expect(tokenMatches(null, null)).toBe(false);
    expect(tokenMatches('x', undefined)).toBe(false);
    expect(tokenMatches(undefined, 'x')).toBe(false);
    expect(tokenMatches(['x'], 'x')).toBe(false);
    expect(tokenMatches({ toString: () => 'x' }, 'x')).toBe(false);
  });
});

describe('ownEntry', () => {
  it('returns own properties only', () => {
    const m = { a: 1 };
    expect(ownEntry(m, 'a')).toBe(1);
    for (const k of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'missing']) {
      expect(ownEntry(m, k)).toBeUndefined();
    }
  });

  it('tolerates non-string keys and missing maps', () => {
    expect(ownEntry({ a: 1 }, undefined)).toBeUndefined();
    expect(ownEntry({ 1: 'x' }, 1)).toBeUndefined();
    expect(ownEntry(null, 'a')).toBeUndefined();
  });
});
