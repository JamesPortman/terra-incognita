// Build the offline search gazetteer: countries (with bounding boxes, from the map
// GeoJSON), admin-1 regions (bounding boxes derived from their member cities), and
// cities with population >= 50k (from GeoNames cities15000.txt).
// Sources are re-downloaded, never committed:
//   curl -sO https://download.geonames.org/export/dump/cities15000.zip  (then unzip)
//   curl -sO https://download.geonames.org/export/dump/countryInfo.txt
//   curl -sO https://download.geonames.org/export/dump/admin1CodesASCII.txt
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

// ISO2 -> country name (for city/region sub-labels)
const iso = {};
for (const line of fs.readFileSync(path.join(dir, 'countryInfo.txt'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const f = line.split('\t');
  if (f[0] && f[4]) iso[f[0]] = f[4];
}

// country names repeat thousands of times across cities/regions — emit them
// once in SEARCH_CC and store an index in `s` (the client re-expands at load)
const ccNames = [];
const ccIdx = new Map();
const ccRef = (cc) => {
  const name = iso[cc] || cc;
  if (!ccIdx.has(name)) { ccIdx.set(name, ccNames.length); ccNames.push(name); }
  return ccIdx.get(name);
};

// one pass over all GeoNames cities (>=15k pop): collect the search cities
// (>=50k) and grow each admin-1 region's bbox from every member city
const cities = [];
const regionBox = new Map(); // "CC.ADM1" -> [x0, y0, x1, y1]
for (const line of fs.readFileSync(path.join(dir, 'cities15000.txt'), 'utf8').split('\n')) {
  if (!line) continue;
  const f = line.split('\t');
  const pop = parseInt(f[14], 10) || 0;
  const x = r1(px(parseFloat(f[5]))), y = r1(py(parseFloat(f[4])));
  if (f[8] && f[10]) {
    const key = `${f[8]}.${f[10]}`;
    const b = regionBox.get(key);
    if (!b) regionBox.set(key, [x, y, x, y]);
    else {
      if (x < b[0]) b[0] = x; if (x > b[2]) b[2] = x;
      if (y < b[1]) b[1] = y; if (y > b[3]) b[3] = y;
    }
  }
  if (pop < 50000) continue;
  cities.push({ n: f[1], s: ccRef(f[8]), x, y, p: pop });
}
cities.sort((a, b) => b.p - a.p);
for (const c of cities) delete c.p; // order encodes rank; drop population

// admin-1 regions (states/provinces): named in admin1CodesASCII, box from cities.
// Pad the box (cities under-cover a region) and enforce a minimum span so a
// one-city region doesn't zoom to a degenerate box.
const MIN_SPAN = 8; // map px (~3 degrees longitude)
const regions = [];
for (const line of fs.readFileSync(path.join(dir, 'admin1CodesASCII.txt'), 'utf8').split('\n')) {
  if (!line) continue;
  const f = line.split('\t');
  const b = regionBox.get(f[0]);
  if (!b || !f[1]) continue;
  const cc = f[0].split('.')[0];
  let [x0, y0, x1, y1] = b;
  const padX = Math.max((x1 - x0) * 0.15, (MIN_SPAN - (x1 - x0)) / 2, 1);
  const padY = Math.max((y1 - y0) * 0.15, (MIN_SPAN - (y1 - y0)) / 2, 1);
  x0 = Math.max(0, r1(x0 - padX)); x1 = Math.min(W, r1(x1 + padX));
  y0 = Math.max(0, r1(y0 - padY)); y1 = Math.min(H, r1(y1 + padY));
  regions.push({ n: f[1], s: ccRef(cc), b: [x0, y0, x1, y1] });
}
regions.sort((a, b) => a.n.localeCompare(b.n));

const out = 'const SEARCH_COUNTRIES=' + JSON.stringify(countries) +
  ';const SEARCH_CC=' + JSON.stringify(ccNames) +
  ';const SEARCH_REGIONS=' + JSON.stringify(regions) +
  ';const SEARCH_CITIES=' + JSON.stringify(cities) + ';';
fs.writeFileSync(path.join(dir, 'search-data.js'), out);
console.log('countries:', countries.length, 'regions:', regions.length,
  'cities:', cities.length, 'size:', (out.length / 1024).toFixed(1) + 'KB');
