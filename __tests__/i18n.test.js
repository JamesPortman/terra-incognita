import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import LOCATIONS from '../shared/locations.js';
import LOC_I18N from '../shared/locations.i18n.js';
import rooms from '../api/_lib/rooms.js';

const root = path.join(import.meta.dirname, '..');
const template = fs.readFileSync(path.join(root, 'build/game-template.html'), 'utf8');

// The client's MESSAGES table is plain data inside the template, so read it from
// the source of truth rather than the built index.html, which can lag behind.
function clientMessages() {
  const start = template.indexOf('const MESSAGES = {');
  const end = template.indexOf('const LANGS =');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return eval(`${template.slice(start, end).replace('const MESSAGES', 'var MESSAGES')}\n;MESSAGES`);
}

// Every fail(res, status, 'code', 'english') across the API, by code.
function serverErrors() {
  const files = fs.readdirSync(path.join(root, 'api'))
    .filter((f) => f.endsWith('.js')).map((f) => `api/${f}`)
    .concat(['api/_lib/ratelimit.js']);
  const out = {};
  for (const rel of files) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const m of src.matchAll(/fail\(res, \d+, '([a-z_]+)', (?:'((?:[^'\\]|\\.)*)'|`([^`]*)`)/g)) {
      const text = m[2] !== undefined
        ? m[2].replace(/\\'/g, "'")
        : m[3].replace(/\$\{MAX_PLAYERS\}/, '{0}'); // the one parameterized message
      if (out[m[1]] && out[m[1]] !== text) {
        throw new Error(`code "${m[1]}" is used with two different messages`);
      }
      out[m[1]] = text;
    }
  }
  return out;
}

describe('location translations', () => {
  const langs = Object.keys(LOC_I18N);

  it('covers Spanish, Portuguese and Farsi', () => {
    expect(langs.sort()).toEqual(['es', 'fa', 'pt']);
  });

  it.each(['es', 'pt', 'fa'])('has a [name, place] pair for every location in %s', (lang) => {
    const table = LOC_I18N[lang];
    expect(Object.keys(table)).toHaveLength(LOCATIONS.length);
    for (const loc of LOCATIONS) {
      const entry = table[loc.k];
      expect(entry, `missing ${lang} text for "${loc.k}"`).toBeDefined();
      expect(entry).toHaveLength(2);
      for (const s of entry) {
        expect(typeof s).toBe('string');
        expect(s.trim()).not.toBe('');
      }
    }
  });

  it.each(['es', 'pt', 'fa'])('has no %s entries for locations that no longer exist', (lang) => {
    const keys = new Set(LOCATIONS.map((l) => l.k));
    expect(Object.keys(LOC_I18N[lang]).filter((k) => !keys.has(k))).toEqual([]);
  });

  it('gives every world-deck place a distinct Portuguese pair', () => {
    // e2e/solo.spec.js leans on this: it plays the world deck in Portuguese and
    // fails if a reveal shows the English pair. Halves may coincide ('Petra'),
    // the pair may not, or that check quietly stops proving anything.
    const { DECK_KEYS } = require('../shared/decks.js');
    const keys = new Set(DECK_KEYS.world);
    const same = LOCATIONS.filter((l) => keys.has(l.k) &&
      LOC_I18N.pt[l.k][0] === l.name && LOC_I18N.pt[l.k][1] === l.place);
    expect(same.map((l) => l.k)).toEqual([]);
  });

  it('writes every Farsi pair in Persian script', () => {
    // a Latin-only entry would render left-to-right inside a right-to-left
    // card; acronyms may ride along (MASP) as long as the Persian is there
    const persian = /[\u0600-\u06FF]/;
    const latinOnly = LOCATIONS.filter((l) => LOC_I18N.fa[l.k].some((s) => !persian.test(s)));
    expect(latinOnly.map((l) => l.k)).toEqual([]);
  });

  it('actually translates — most places differ from the English', () => {
    // guards against a table of copy-pasted English sneaking in
    for (const lang of langs) {
      const differing = LOCATIONS.filter((l) => LOC_I18N[lang][l.k][1] !== l.place).length;
      expect(differing).toBeGreaterThan(LOCATIONS.length / 2);
    }
  });
});

describe('fail()', () => {
  it('sends the English text, the code, and any extra fields', () => {
    let sent = null;
    const res = { status: () => ({ json: (b) => { sent = b; } }) };
    rooms.fail(res, 409, 'already_played_week', 'already played this week', { yourScore: 12 });
    expect(sent).toEqual({ error: 'already played this week', code: 'already_played_week', yourScore: 12 });
  });
});

describe('interface translations', () => {
  const M = clientMessages();

  it.each(['es', 'pt', 'fa'])('has exactly the English keys in %s', (lang) => {
    expect(Object.keys(M[lang]).sort()).toEqual(Object.keys(M.en).sort());
  });

  it.each(['es', 'pt', 'fa'])('keeps every {n} placeholder in %s', (lang) => {
    const holes = (s) => (s.match(/\{\d\}/g) || []).sort();
    for (const [key, text] of Object.entries(M.en)) {
      expect(holes(M[lang][key]), key).toEqual(holes(text));
    }
  });

  it('lays Farsi out right-to-left', () => {
    expect(template).toMatch(/fa: "فارسی"/);
    expect(template).toMatch(/RTL_LANGS = new Set\(\["fa"\]\)/);
    expect(template).toMatch(/documentElement\.dir = RTL_LANGS\.has\(LANG\)/);
  });
});

describe('API error messages', () => {
  const server = serverErrors();
  const M = clientMessages();

  it('finds every error the API can send', () => {
    expect(Object.keys(server).length).toBeGreaterThan(20);
  });

  it('has an English message identical to the server text for every code', () => {
    // the English strings are also the fallback for any client that predates a
    // new code, so a drift here would show players two different sentences
    for (const [code, text] of Object.entries(server)) {
      expect(M.en[`api.${code}`], `api.${code}`).toBe(text);
    }
  });

  it.each(['es', 'pt', 'fa'])('translates every error code into %s', (lang) => {
    for (const code of Object.keys(server)) {
      const s = M[lang][`api.${code}`];
      expect(s, `api.${code} missing in ${lang}`).toBeTruthy();
      if (server[code].includes('{0}')) expect(s).toContain('{0}');
    }
  });

  it('translates the generic request failure too', () => {
    for (const lang of ['en', 'es', 'pt', 'fa']) expect(M[lang]['api.failed']).toContain('{0}');
  });

  it('leaves no error responses without a code', () => {
    const files = fs.readdirSync(path.join(root, 'api'))
      .filter((f) => f.endsWith('.js')).map((f) => `api/${f}`)
      .concat(fs.readdirSync(path.join(root, 'api/_lib')).map((f) => `api/_lib/${f}`));
    for (const rel of files) {
      if (rel === 'api/_lib/rooms.js') continue; // defines fail() itself
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(src.match(/sendJSON\([^)]*error:/g), `${rel} sends an uncoded error`).toBeNull();
    }
  });
});
