// The location photos are third-party (Wikimedia Commons, mostly CC BY-SA), so
// every one must be credited individually. These tests keep the credit data, the
// generated credits page and the served photos directory in step with
// shared/locations.js.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import LOCATIONS from '../shared/locations.js';

const root = path.join(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const CREDITS = JSON.parse(read('build/photo-credits.json'));
const creditsHtml = read('credits.html');
const index = read('index.html');
const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

describe('photo credits', () => {
  it('has exactly one entry per location', () => {
    expect(Object.keys(CREDITS).sort()).toEqual(LOCATIONS.map((l) => l.k).sort());
  });

  it.each(LOCATIONS.map((l) => [l.k]))('credits %s with its source article', (k) => {
    const c = CREDITS[k];
    expect(c.article.trim()).not.toBe('');
    expect(c.articleUrl).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\/\S+$/);
    if (c.file) expect(c.fileUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:\S+$/);
  });

  it('a photo replaced via build/photo-overrides.json is credited to that file', () => {
    const f = path.join(root, 'build/photo-overrides.json');
    const pinned = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
    for (const [k, file] of Object.entries(pinned)) {
      expect(CREDITS[k], `unknown override key "${k}"`).toBeTruthy();
      expect(CREDITS[k].file, `${k}: run node build/build-credits.js --fetch`).toBe(file);
    }
  });

  it('credits.html is rebuilt from the current credit data', () => {
    for (const l of LOCATIONS) {
      expect(creditsHtml, `credits.html is missing "${l.k}" — run node build/assemble.js`).toContain(`<tr id="${l.k}">`);
      expect(creditsHtml).toContain(`href="${escAttr(CREDITS[l.k].articleUrl)}"`);
      if (CREDITS[l.k].file) expect(creditsHtml).toContain(`href="${escAttr(CREDITS[l.k].fileUrl)}"`);
    }
  });

  it('credits.html uses relative URLs so it works under the /terra-incognita proxy too', () => {
    expect(creditsHtml).not.toMatch(/(?:src|href)="\/(?!\/)/);
  });

  it('the in-game photo credit links to the credits page, relatively', () => {
    expect(index).toMatch(/<a href="credits"[^>]*data-i18n="credit\.photo"/);
    expect(JSON.parse(read('vercel.json')).rewrites)
      .toContainEqual({ source: '/credits', destination: '/credits.html' });
  });
});

describe('served photos', () => {
  it('photos/ holds exactly one jpg per location', () => {
    const files = fs.readdirSync(path.join(root, 'photos')).sort();
    expect(files).toEqual(LOCATIONS.map((l) => l.k + '.jpg').sort());
  });

  it('every embedded location points at /photos/<key>.jpg', () => {
    for (const l of LOCATIONS) expect(index).toContain(`"img":"/photos/${l.k}.jpg"`);
  });
});
