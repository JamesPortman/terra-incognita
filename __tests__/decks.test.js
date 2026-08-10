import { describe, it, expect } from 'vitest';
import decksMod from '../shared/decks.js';
import LOCATIONS from '../shared/locations.js';

const { DECKS, DECK_KEYS, DECK_LABELS } = decksMod;

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

  it('labels every deck (plus random), with real em-dashes for famous decks', () => {
    // the Hall's deck filter byte-matches these labels — the dash must be U+2014
    for (const id of Object.keys(DECKS)) expect(DECK_LABELS[id]).toBeTruthy();
    expect(DECK_LABELS.random).toBe('Random world (Street View)');
    for (const id of ['world', 'na', 'sa', 'us']) {
      expect(DECK_LABELS[id]).toContain('—');
      expect(DECK_LABELS[id]).toMatch(/Famous Places$/);
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
