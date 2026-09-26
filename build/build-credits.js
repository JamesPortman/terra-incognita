// Maintain build/photo-credits.json: where each location photo came from, so the
// credits page (credits.html, written by assemble.js) can attribute every image.
//
// The photos are NOT ours. build-photos.sh downloads the lead image of an English
// Wikipedia article for each location; those images live on Wikimedia Commons
// under their own licences (mostly CC BY-SA), which require per-image credit.
//
//   node build/build-credits.js           # offline: sync article titles from build-photos.sh
//   node build/build-credits.js --fetch   # also look up file name, author and licence
//
// --fetch asks Wikipedia for each article's *current* lead image and Commons for
// that file's metadata. An article's lead image can change after our photo was
// downloaded, so compare the file against photos/<key>.jpg before trusting it —
// entries are only filled in where missing, and a hand-corrected entry is kept.
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const OUT = path.join(dir, 'photo-credits.json');
const UA = 'terra-incognita-credits/1.0 (https://github.com/JamesPortman/terra-incognita)';

// The article titles live in build-photos.sh (the script that fetched the photos).
function articleTitles() {
  // Only the titles=( … ) block: photoquery=( … ) uses the same "key "value"" shape.
  const src = fs.readFileSync(path.join(dir, 'build-photos.sh'), 'utf8');
  const block = src.match(/^titles=\($([\s\S]*?)^\)$/m);
  if (!block) throw new Error('build-photos.sh: titles=( … ) block not found');
  return Object.fromEntries([...block[1].matchAll(/^ {2}([a-z]+) "([^"]+)"$/gm)].map((m) => [m[1], m[2]]));
}

const wikiUrl = (title) => 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_')).replace(/%2C/g, ',');
const fileUrl = (file) => 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(file.replace(/ /g, '_'));
const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

async function getJson(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

// Photos build-photos.sh took from a Commons search instead of the article's
// lead image (the lead image was a logo/map/sign that gave the round away).
function overrides() {
  const f = path.join(dir, 'photo-overrides.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
}

async function fileMeta(file) {
  const m = new URLSearchParams({ action: 'query', titles: 'File:' + file, prop: 'imageinfo', iiprop: 'extmetadata', format: 'json' });
  const info = Object.values((await getJson('https://commons.wikimedia.org/w/api.php?' + m)).query.pages)[0];
  const meta = info.imageinfo?.[0]?.extmetadata || {};
  const out = { file, fileUrl: fileUrl(file) };
  if (meta.Artist) out.author = stripHtml(meta.Artist.value);
  if (meta.LicenseShortName) out.license = stripHtml(meta.LicenseShortName.value);
  if (meta.LicenseUrl) out.licenseUrl = meta.LicenseUrl.value;
  return out;
}

async function lookup(title) {
  const q = new URLSearchParams({ action: 'query', titles: title, prop: 'pageimages', piprop: 'name', redirects: '1', format: 'json' });
  const page = Object.values((await getJson('https://en.wikipedia.org/w/api.php?' + q)).query.pages)[0];
  if (!page.pageimage) return {};
  return fileMeta(page.pageimage.replace(/_/g, ' '));
}

async function main() {
  const titles = articleTitles();
  const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const pinned = overrides();
  const out = {};
  for (const [k, article] of Object.entries(titles).sort(([a], [b]) => a.localeCompare(b))) {
    out[k] = { ...existing[k], article, articleUrl: wikiUrl(article) };
    // A photo replaced via an override: drop the old file's credit so it's refetched.
    if (pinned[k] && out[k].file !== pinned[k]) {
      for (const f of ['file', 'fileUrl', 'author', 'license', 'licenseUrl']) delete out[k][f];
    }
  }
  if (process.argv.includes('--fetch')) {
    for (const [k, e] of Object.entries(out)) {
      if (e.file) continue;
      try {
        Object.assign(e, pinned[k] ? await fileMeta(pinned[k]) : await lookup(e.article));
        console.log(e.file ? 'OK  ' : 'NONE', k, e.file || '');
      } catch (err) {
        console.log('FAIL', k, err.message);
      }
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log('wrote photo-credits.json', Object.keys(out).length, 'entries');
}

main();
