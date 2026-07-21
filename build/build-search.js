// Build the offline search gazetteer: countries (with bounding boxes, from the map
// GeoJSON) + cities with population >= 200k (from GeoNames cities15000.txt).
const fs = require('fs');
const path = require('path');
const dir = __dirname;

const W = 1000, LAT_TOP = 85, LAT_BOT = -60;
const H = Math.round(((LAT_TOP - LAT_BOT) / 360) * W * 10) / 10;
const px = (lon) => ((lon + 180) / 360) * W;
const py = (lat) => ((LAT_TOP - Math.max(LAT_BOT, Math.min(LAT_TOP, lat))) / (LAT_TOP - LAT_BOT)) * H;
const r1 = (n) => Math.round(n * 10) / 10;

// countries: name + bbox in map coordinates
const geo = JSON.parse(fs.readFileSync(path.join(dir, 'countries.geo.json'), 'utf8'));
const countries = [];
for (const f of geo.features) {
  if (f.id === 'ATA') continue;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) for (const ring of poly) for (const [lon, lat] of ring) {
    if (lat < LAT_BOT - 2) continue;
    const x = px(lon), y = py(lat);
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  countries.push({ n: f.properties.name, b: [r1(x0), r1(y0), r1(x1), r1(y1)] });
}

// ISO2 -> country name (for city sub-labels)
const iso = {};
for (const line of fs.readFileSync(path.join(dir, 'countryInfo.txt'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const f = line.split('\t');
  if (f[0] && f[4]) iso[f[0]] = f[4];
}

// cities: population >= 200k
const cities = [];
for (const line of fs.readFileSync(path.join(dir, 'cities15000.txt'), 'utf8').split('\n')) {
  if (!line) continue;
  const f = line.split('\t');
  const pop = parseInt(f[14], 10) || 0;
  if (pop < 200000) continue;
  cities.push({ n: f[1], s: iso[f[8]] || f[8], x: r1(px(parseFloat(f[5]))), y: r1(py(parseFloat(f[4]))), p: pop });
}
cities.sort((a, b) => b.p - a.p);
for (const c of cities) delete c.p; // order encodes rank; drop population

const out = 'const SEARCH_COUNTRIES=' + JSON.stringify(countries) +
  ';const SEARCH_CITIES=' + JSON.stringify(cities) + ';';
fs.writeFileSync(path.join(dir, 'search-data.js'), out);
console.log('countries:', countries.length, 'cities:', cities.length, 'size:', (out.length / 1024).toFixed(1) + 'KB');
