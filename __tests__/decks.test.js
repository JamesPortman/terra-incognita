import { describe, it, expect } from 'vitest';
import decksMod from '../shared/decks.js';
import LOCATIONS from '../shared/locations.js';

const { DECKS, DECK_KEYS } = decksMod;

describe('famous decks', () => {
  it('defines world, na, sa, and us decks of exactly 50 places each', () => {
    for (const id of ['world', 'na', 'sa', 'us']) {
      expect(DECKS[id]).toHaveLength(50);
      expect(new Set(DECKS[id]).size).toBe(50);
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
    expect(names('us')).toContain('empirestate');
    expect(names('us')).toContain('waikiki');
    expect(names('us')).not.toContain('cntower');
  });

  it('keeps deck pools large enough for the 10-round maximum', () => {
    for (const pool of Object.values(DECKS)) expect(pool.length).toBeGreaterThanOrEqual(10);
  });
});
