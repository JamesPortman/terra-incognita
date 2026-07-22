const fs = require('fs');
const path = require('path');
const dir = __dirname;

const LOCS = require('../shared/locations.js');

// Photos are served as static files from /photos (copy build/photos -> ../photos
// after fetching); embedding them inline would put ~7MB of base64 in the page.
const locs = LOCS.map((l) => {
  if (!fs.existsSync(path.join(dir, '..', 'photos', l.k + '.jpg'))) {
    throw new Error(`missing photo for "${l.k}" — run build/build-photos.sh and copy build/photos -> photos`);
  }
  return { name: l.name, place: l.place, lat: l.lat, lon: l.lon, img: '/photos/' + l.k + '.jpg' };
});

const mapData = fs.readFileSync(path.join(dir, 'map-data.js'), 'utf8');
const searchData = fs.readFileSync(path.join(dir, 'search-data.js'), 'utf8');
let html = fs.readFileSync(path.join(dir, 'game-template.html'), 'utf8');
html = html.replace('__MAP_DATA__', () => mapData);
html = html.replace('__SEARCH_DATA__', () => searchData);
const locsJson = JSON.stringify(locs).replace(/[\u007f-\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
html = html.replace('__LOCATIONS__', () => locsJson);
fs.writeFileSync(path.join(dir, 'terra-incognita.html'), html);
console.log('wrote terra-incognita.html', (html.length / 1024 / 1024).toFixed(2) + 'MB');
