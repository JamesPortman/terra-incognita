// Link-preview metadata lives in build/game-template.html and only reaches users
// through the built index.html — so this guards against editing the template and
// forgetting to rebuild, which would silently ship a blank card again.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const head = index.slice(0, index.indexOf('</head>'));

const OG_IMAGE = 'https://terra-incognita-amber.vercel.app/og.jpg';

describe('social link preview', () => {
  it('ships the Open Graph tags a crawler needs for a large card', () => {
    for (const tag of ['og:type', 'og:url', 'og:title', 'og:description', 'og:image']) {
      expect(head, `missing ${tag}`).toContain(`property="${tag}"`);
    }
    expect(head).toContain('name="twitter:card"');
    expect(head).toContain('summary_large_image');
  });

  it('points at an image that actually exists at that path', () => {
    expect(head).toContain(OG_IMAGE);
    const file = OG_IMAGE.replace('https://terra-incognita-amber.vercel.app/', '');
    expect(fs.existsSync(path.join(root, file)), `${file} is not in the repo`).toBe(true);
  });

  it('declares the 1.91:1 dimensions LinkedIn uses to pick the large card', () => {
    expect(head).toContain('content="1200"');
    expect(head).toContain('content="627"');
  });
});
