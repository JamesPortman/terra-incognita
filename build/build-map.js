// Convert countries GeoJSON to compact SVG path strings (equirectangular, lat clipped to [-60, 85])
const fs = require('fs');
const geo = JSON.parse(fs.readFileSync(__dirname + '/countries.geo.json', 'utf8'));

const W = 1000;
const LAT_TOP = 85, LAT_BOT = -60;
const H = Math.round(((LAT_TOP - LAT_BOT) / 360) * W * 10) / 10; // ~402.8

const px = (lon) => ((lon + 180) / 360) * W;
const py = (lat) => ((LAT_TOP - lat) / (LAT_TOP - LAT_BOT)) * H;
const r1 = (n) => Math.round(n * 10) / 10;

function ringToPath(ring) {
  let d = '';
  let lastX = null, lastY = null;
  for (const [lon, lat] of ring) {
    if (lat < LAT_BOT - 2) continue; // drop deep-Antarctic points
    const x = r1(px(lon)), y = r1(py(Math.min(lat, LAT_TOP)));
    if (lastX === null) {
      d += `M${x} ${y}`;
    } else {
      if (Math.abs(x - lastX) < 0.35 && Math.abs(y - lastY) < 0.35) continue;
      d += `L${x} ${y}`;
    }
    lastX = x; lastY = y;
  }
  return d ? d + 'Z' : '';
}

let paths = [];
for (const f of geo.features) {
  if (f.id === 'ATA') continue; // skip Antarctica
  const g = f.geometry;
  let d = '';
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const poly of polys) for (const ring of poly) d += ringToPath(ring);
  if (d) paths.push(d);
}

const out = `const MAP_W=${W},MAP_H=${H};const MAP_PATHS=${JSON.stringify(paths)};`;
fs.writeFileSync(__dirname + '/map-data.js', out);
console.log('countries:', paths.length, 'size:', (out.length / 1024).toFixed(1) + 'KB', 'H=' + H);
