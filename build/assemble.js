const fs = require('fs');
const path = require('path');
const dir = __dirname;

const LOCS = require('../shared/locations.js');

const locs = LOCS.map((l) => {
  const img = fs.readFileSync(path.join(dir, 'photos', l.k + '.jpg'));
  return { name: l.name, place: l.place, lat: l.lat, lon: l.lon, img: 'data:image/jpeg;base64,' + img.toString('base64') };
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
