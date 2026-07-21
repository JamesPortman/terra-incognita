import { describe, it, expect } from 'vitest';
import rooms from '../api/_lib/rooms.js';
import LOCATIONS from '../shared/locations.js';

const { haversineKm, pointsFor, newCode, newDeck, ROUNDS } = rooms;

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm(45, -80, 45, -80)).toBe(0);
  });

  it('matches known distance Paris -> Tokyo (~9,712 km)', () => {
    const km = haversineKm(48.8584, 2.2945, 35.6595, 139.7005);
    expect(km).toBeGreaterThan(9600);
    expect(km).toBeLessThan(9850);
  });

  it('matches known distance NYC -> London (~5,570 km)', () => {
    const km = haversineKm(40.7128, -74.006, 51.5074, -0.1278);
    expect(km).toBeGreaterThan(5500);
    expect(km).toBeLessThan(5650);
  });

  it('handles antipodal-ish points without NaN', () => {
    const km = haversineKm(90, 0, -90, 0);
    expect(km).toBeCloseTo(Math.PI * 6371, 0);
  });
});

describe('pointsFor', () => {
  it('gives 5000 for a perfect guess', () => {
    expect(pointsFor(0)).toBe(5000);
  });

  it('decays with distance', () => {
    expect(pointsFor(100)).toBeGreaterThan(pointsFor(1000));
    expect(pointsFor(1000)).toBeGreaterThan(pointsFor(10000));
  });

  it('gives ~1839 at 2000 km (one e-folding)', () => {
    expect(pointsFor(2000)).toBe(Math.round(5000 / Math.E));
  });

  it('rounds to zero on the far side of the planet', () => {
    expect(pointsFor(20000)).toBe(0);
  });
});

describe('newCode', () => {
  it('makes 4-char codes from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      expect(newCode()).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    }
  });

  it('never contains easily-confused characters', () => {
    const banned = /[ILO01]/;
    for (let i = 0; i < 200; i++) {
      expect(newCode()).not.toMatch(banned);
    }
  });
});

describe('newDeck', () => {
  it('picks ROUNDS unique in-range location indices', () => {
    for (let i = 0; i < 50; i++) {
      const deck = newDeck();
      expect(deck).toHaveLength(ROUNDS);
      expect(new Set(deck).size).toBe(ROUNDS);
      for (const idx of deck) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(LOCATIONS.length);
      }
    }
  });

  it('varies between games', () => {
    const decks = new Set();
    for (let i = 0; i < 20; i++) decks.add(newDeck().join(','));
    expect(decks.size).toBeGreaterThan(1);
  });
});

describe('locations data', () => {
  it('has 20 locations with valid coordinates and unique keys', () => {
    expect(LOCATIONS).toHaveLength(20);
    const keys = new Set(LOCATIONS.map((l) => l.k));
    expect(keys.size).toBe(LOCATIONS.length);
    for (const l of LOCATIONS) {
      expect(l.name).toBeTruthy();
      expect(l.place).toBeTruthy();
      expect(Math.abs(l.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(l.lon)).toBeLessThanOrEqual(180);
    }
  });
});
