import { describe, it, expect } from 'vitest';
import decksMod from '../shared/decks.js';
import LOCATIONS from '../shared/locations.js';

const { DECKS, DECK_KEYS } = decksMod;

describe('famous decks', () => {
  it('defines world, na, and sa decks of 30-40 places each', () => {
    for (const id of ['world', 'na', 'sa']) {
      expect(DECKS[id].length).toBeGreaterThanOrEqual(30);
      expect(DECKS[id].length).toBeLessThanOrEqual(40);
      expect(new Set(DECKS[id]).size).toBe(DECKS[id].length);
    }
  });

  it('resolves every key to a valid location index', () => {
    for (const pool of Object.values(DECKS)) {
      for (const i of pool) {
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(LOCATIONS.length);
      }
    }
  });

  it('places regional picks in the right deck', () => {
    const names = (id) => DECKS[id].map((i) => LOCATIONS[i].k);
    expect(names('na')).toContain('chichenitza');
    expect(names('na')).toContain('cntower');
    expect(names('na')).not.toContain('eiffel');
    expect(names('sa')).toContain('machupicchu');
    expect(names('sa')).toContain('iguazufalls');
    expect(names('sa')).not.toContain('sydneyopera');
    expect(names('world')).toContain('eiffel');
  });

  it('keeps deck pools large enough for the 10-round maximum', () => {
    for (const pool of Object.values(DECKS)) expect(pool.length).toBeGreaterThanOrEqual(10);
  });
});
