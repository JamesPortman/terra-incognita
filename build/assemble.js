const fs = require('fs');
const path = require('path');
const dir = __dirname;

const LOCS = require('../shared/locations.js');
const { DECKS } = require('../shared/decks.js');
const LOC_I18N = require('../shared/locations.i18n.js');

// Writes the two served pages at the site root — index.html (the game) and
// credits.html (per-photo attribution) — and stamps version.txt. Both pages are
// committed; there is no intermediate copy to keep in sync.
//
// Photos are served as static files from /photos (build/build-photos.sh writes
// there); embedding them inline would put ~7MB of base64 in the page.
const root = path.join(dir, '..');
const CREDITS = JSON.parse(fs.readFileSync(path.join(dir, 'photo-credits.json'), 'utf8'));
const locs = LOCS.map((l) => {
  if (!fs.existsSync(path.join(root, 'photos', l.k + '.jpg'))) {
    throw new Error(`missing photo for "${l.k}" — run build/build-photos.sh`);
  }
  // The photos are third-party (Wikimedia Commons, mostly CC BY-SA): none may ship uncredited.
  if (!CREDITS[l.k]) {
    throw new Error(`missing photo credit for "${l.k}" — add its article to build/build-photos.sh and run build/build-credits.js`);
  }
  // Every language must cover every location, so a new place cannot ship
  // half-translated with English leaking into a Spanish, Portuguese or Farsi round.
  const i18n = {};
  for (const [lang, table] of Object.entries(LOC_I18N)) {
    if (!table[l.k]) throw new Error(`missing ${lang} text for "${l.k}" — add it to shared/locations.i18n.js`);
    i18n[lang] = table[l.k];
  }
  return { name: l.name, place: l.place, lat: l.lat, lon: l.lon, img: '/photos/' + l.k + '.jpg', i18n };
});

const mapData = fs.readFileSync(path.join(dir, 'map-data.js'), 'utf8');
const searchData = fs.readFileSync(path.join(dir, 'search-data.js'), 'utf8');
let html = fs.readFileSync(path.join(dir, 'game-template.html'), 'utf8');
html = html.replace('__MAP_DATA__', () => mapData);
html = html.replace('__SEARCH_DATA__', () => searchData);
html = html.replace('__DECKS__', () => 'const DECKS=' + JSON.stringify(DECKS) + ';');
const locsJson = JSON.stringify(locs).replace(/[\u007f-\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
html = html.replace('__LOCATIONS__', () => locsJson);
const buildId = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
html = html.replace('__BUILD_ID__', buildId);
fs.writeFileSync(path.join(root, 'version.txt'), buildId + '\n');
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('wrote index.html', (html.length / 1024 / 1024).toFixed(2) + 'MB');

// ---- credits.html ----
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const link = (href, text) => `<a href="${esc(href)}" rel="noopener">${esc(text)}</a>`;
const rows = [...LOCS].sort((a, b) => a.name.localeCompare(b.name)).map((l) => {
  const c = CREDITS[l.k];
  const image = c.file
    ? link(c.fileUrl, c.file) + (c.author ? ` &middot; ${esc(c.author)}` : '') +
      (c.license ? ` &middot; ${c.licenseUrl ? link(c.licenseUrl, c.license) : esc(c.license)}` : '')
    : `lead image of ${link(c.articleUrl, c.article)} &mdash; its file page carries author and licence`;
  return `<tr id="${esc(l.k)}"><td><img src="photos/${esc(l.k)}.jpg" alt="" loading="lazy" width="96" height="64"></td>` +
    `<td><b>${esc(l.name)}</b><br><span class="muted">${esc(l.place)}</span></td>` +
    `<td>${link(c.articleUrl, 'Wikipedia: ' + c.article)}</td><td>${image}</td></tr>`;
}).join('\n');
const credits = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Photo credits &#8212; Terra Incognita</title>
<meta name="description" content="Credits and licences for the location photos in Terra Incognita.">
<style>
  :root { --ink: #0c1220; --raised: #182338; --line: #263352; --brass: #d9a441; --parchment: #ece5d3; --muted: #8f99ad; }
  @media (prefers-color-scheme: light) {
    :root { --ink: #ece5d6; --raised: #f5efe1; --line: #c9bda1; --brass: #96690f; --parchment: #262c3a; --muted: #6a7180; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--ink); color: var(--parchment); font: 15px/1.5 -apple-system, "Segoe UI", system-ui, sans-serif; }
  main { max-width: 1100px; margin: 0 auto; padding: 32px 16px 64px; }
  h1 { font-family: "Iowan Old Style", Palatino, Georgia, serif; font-weight: 600; margin: 0 0 12px; }
  p { max-width: 70ch; }
  a { color: var(--brass); overflow-wrap: anywhere; }
  .muted { color: var(--muted); font-size: 0.9em; }
  .wrap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; margin-top: 24px; }
  th, td { text-align: start; vertical-align: top; padding: 8px 10px; border-bottom: 1px solid var(--line); }
  th { color: var(--muted); font-weight: 600; font-size: 0.8rem; letter-spacing: 0.06em; text-transform: uppercase; }
  td img { display: block; width: 96px; height: 64px; object-fit: cover; border-radius: 3px; background: var(--raised); }
  :target { background: var(--raised); }
</style>
</head>
<body>
<main>
<h1>Photo credits</h1>
<p>The location photos are not part of this project and are not covered by its MIT licence.
They come from <a href="https://commons.wikimedia.org/" rel="noopener">Wikimedia Commons</a> via
English Wikipedia, and each remains under its own licence (mostly Creative Commons
Attribution-ShareAlike) and belongs to its author. The copies here are downscaled.</p>
<p>Each photo below links to the Wikipedia article whose lead image it is${Object.values(CREDITS).some((c) => c.file) ? ', and where recorded to its Commons file page, author and licence' : ''}.
The image's file page on Wikimedia Commons, reached from that article, gives the full author,
licence and source details.</p>
<p><a href="./">&larr; Back to the game</a></p>
<div class="wrap"><table>
<thead><tr><th></th><th>Location</th><th>Source article</th><th>Image</th></tr></thead>
<tbody>
${rows}
</tbody>
</table></div>
</main>
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'credits.html'), credits);
console.log('wrote credits.html', LOCS.length, 'photos');
