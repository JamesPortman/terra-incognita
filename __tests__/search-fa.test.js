import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const root = path.join(import.meta.dirname, '..');
const G = {};
new Function('G', fs.readFileSync(path.join(root, 'build/search-data.js'), 'utf8')
  .replace(/const (SEARCH_\w+)=/g, 'G.$1='))(G);
const FA = JSON.parse(fs.readFileSync(path.join(root, 'search-fa.json'), 'utf8'));
const persian = /[؀-ۿ]/;
const presentation = /[ﭐ-﷿ﹰ-﻿]/;
const cityFa = (name, country) => {
  const i = G.SEARCH_CITIES.findIndex((c) => c.n === name && G.SEARCH_CC[c.s] === country);
  expect(i, `${name} is in the gazetteer`).toBeGreaterThan(-1);
  return FA.cities[i];
};

describe('Farsi search names (search-fa.json)', () => {
  it('lines up index for index with search-data.js', () => {
    // the overlay is positional: regenerate it with build/build-search-fa.js
    // whenever build-search.js rebuilds the gazetteer
    expect(FA.n).toEqual([G.SEARCH_COUNTRIES.length, G.SEARCH_CC.length, G.SEARCH_REGIONS.length, G.SEARCH_CITIES.length]);
    expect(FA.countries).toHaveLength(G.SEARCH_COUNTRIES.length);
    expect(FA.cc).toHaveLength(G.SEARCH_CC.length);
    expect(FA.regions).toHaveLength(G.SEARCH_REGIONS.length);
    expect(FA.cities).toHaveLength(G.SEARCH_CITIES.length);
  });

  it('holds only Persian text, never copied English or reversed glyphs', () => {
    const all = [...FA.countries, ...FA.cc, ...FA.regions, ...FA.cities].filter(Boolean);
    expect(all.filter((s) => !persian.test(s) || presentation.test(s))).toEqual([]);
  });

  it('names every country, and nearly all of the biggest cities', () => {
    expect(FA.countries.filter((s) => !s)).toEqual([]);
    const top = FA.cities.slice(0, 100).filter(Boolean).length; // cities are ranked by population
    expect(top).toBeGreaterThanOrEqual(95);
    expect(FA.cities.filter(Boolean).length / FA.cities.length).toBeGreaterThan(0.75);
    expect(FA.regions.filter(Boolean).length / FA.regions.length).toBeGreaterThan(0.75);
  });

  it('gets well-known places right', () => {
    expect(cityFa('Paris', 'France')).toBe('پاریس');
    expect(cityFa('Tehran', 'Iran')).toBe('تهران');
    expect(cityFa('Tokyo', 'Japan')).toBe('توکیو');
    expect(cityFa('Hanoi', 'Vietnam')).toBe('هانوی');     // hand override
    expect(cityFa('Copenhagen', 'Denmark')).toBe('کپنهاگ'); // source misplaces it
    expect(cityFa('Shanghai', 'China')).toBe('شانگهای');   // source lists it as a province
    const country = (n) => FA.countries[G.SEARCH_COUNTRIES.findIndex((c) => c.n === n)];
    expect(country('Iran')).toBe('ایران');
    expect(country('Brazil')).toBe('برزیل');
    expect(country('Macedonia') || country('North Macedonia')).toBe('مقدونیه شمالی');
  });
});
