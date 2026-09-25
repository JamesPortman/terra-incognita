// Build the Farsi overlay for the search gazetteer: a Persian name for each
// country, region and city in build/search-data.js, written to search-fa.json
// at the site root. The client fetches it only when a player picks Farsi, so
// the page stays the same size for everyone else.
//
// Names come from the Countries States Cities Database, whose entries carry a
// `fa` translation. It is ODbL v1.0: attribution is required (README, the
// architecture page, and the `source` field written below), and search-fa.json,
// as a derived database, is itself offered under ODbL v1.0. Sources are re-downloaded, never committed:
//   mkdir -p build/csc && cd build/csc
//   curl -sSLO https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/countries.json
//   curl -sSLO https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/states.json
//   curl -sSL https://github.com/dr5hn/countries-states-cities-database/releases/latest/download/json-cities.json.gz | gunzip > cities.json
//
// The overlay is aligned to search-data.js by array index, so re-run this
// script whenever build-search.js regenerates the gazetteer;
// __tests__/search-fa.test.js fails if the two drift apart.
const fs = require('fs');
const path = require('path');
const dir = __dirname;

const src = fs.readFileSync(path.join(dir, 'search-data.js'), 'utf8');
const G = {};
new Function('G', src.replace(/const (SEARCH_\w+)=/g, 'G.$1=') )(G);
const { SEARCH_COUNTRIES, SEARCH_CC, SEARCH_REGIONS, SEARCH_CITIES } = G;

const csc = (f) => JSON.parse(fs.readFileSync(path.join(dir, 'csc', f), 'utf8'));
const cscCountries = csc('countries.json');
const cscStates = csc('states.json');
const cscCities = csc('cities.json');
// Only real Persian text counts: some entries are the English copied across,
// and a few are stored as reversed presentation-form glyphs (U+FB50-U+FEFF)
// that render backwards.
const PERSIAN = /[\u0600-\u06FF]/, PRESENTATION = /[\uFB50-\uFDFF\uFE70-\uFEFF]/;
const fa = (e) => {
  const s = (e && e.translations && e.translations.fa || '').trim();
  return PERSIAN.test(s) && !PRESENTATION.test(s) ? s : '';
};

// Latin-script key: accents off, lowercase, letters and digits only
const key = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
// same projection as build-search.js
const W = 1000, LAT_TOP = 85, LAT_BOT = -60;
const H = Math.round(((LAT_TOP - LAT_BOT) / 360) * W * 10) / 10;
const px = (lon) => ((lon + 180) / 360) * W;
const py = (lat) => ((LAT_TOP - Math.max(LAT_BOT, Math.min(LAT_TOP, lat))) / (LAT_TOP - LAT_BOT)) * H;

const byIso2 = new Map(cscCountries.map((c) => [c.iso2, c]));
const byIso3 = new Map(cscCountries.map((c) => [c.iso3, c]));

// countries: same order as build-search.js (map GeoJSON features minus ATA)
const geo = JSON.parse(fs.readFileSync(path.join(dir, 'countries.geo.json'), 'utf8'));
const features = geo.features.filter((f) => f.id !== 'ATA');
if (features.length !== SEARCH_COUNTRIES.length) throw new Error('countries.geo.json and search-data.js disagree');
const countries = features.map((f, i) => {
  if (f.properties.name !== SEARCH_COUNTRIES[i].n) throw new Error(`country ${i} is ${SEARCH_COUNTRIES[i].n}, not ${f.properties.name}`);
  return fa(byIso3.get(f.id));
});

// cities: same name, nearest point within ~0.7 degrees
const cityIdx = new Map();
for (const c of cscCities) {
  if (!fa(c)) continue;
  const k = key(c.name);
  if (!cityIdx.has(k)) cityIdx.set(k, []);
  cityIdx.get(k).push(c);
}
// Region names differ in their generic words ("Tehran" vs "Tehran Province"),
// so they are also compared with those dropped.
const GENERIC = /\b(province|region|state|oblast|prefecture|county|department|district|governorate|municipality|autonomous|republic|territory|capital|city|of|the)\b/g;
const rkey = (s) => key(s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(GENERIC, ' '));
const stateByName = new Map();
for (const st of cscStates) {
  if (!fa(st) || st.latitude == null) continue;
  for (const k of new Set([key(st.name), rkey(st.name)])) {
    if (!stateByName.has(k)) stateByName.set(k, []);
    stateByName.get(k).push(st);
  }
}

const nearest = (list, s, max) => {
  let best = null, bestD = max;
  for (const c of list) {
    const d = Math.hypot(px(+c.longitude) - s.x, py(+c.latitude) - s.y);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
};
const MAX_PX = 2;   // ~0.7 degrees between the two sources' city points
const STATE_PX = 4; // a province's centre sits further from its city
const ccVotes = SEARCH_CC.map(() => new Map()); // search country index -> ISO2 tally
const cities = SEARCH_CITIES.map((s) => {
  // Big cities that are their own province (Shanghai, Belgrade, Astana)
  // appear here only as a state, so fall back to a same-named state nearby.
  const best = nearest(cityIdx.get(key(s.n)) || [], s, MAX_PX) ||
    nearest([...(stateByName.get(key(s.n)) || []), ...(stateByName.get(rkey(s.n)) || [])], s, STATE_PX);
  if (!best) return '';
  const v = ccVotes[s.s];
  v.set(best.country_code, (v.get(best.country_code) || 0) + 1);
  return fa(best).replace(/^(استان|شهر خودمختار) /, ''); // a city, not its province
});

// country sub-labels: the ISO2 most of a country's matched cities agree on,
// else a match on the English name
const cscByName = new Map(cscCountries.map((c) => [key(c.name), c]));
const ccIso = SEARCH_CC.map((name, i) => {
  const top = [...ccVotes[i]].sort((a, b) => b[1] - a[1])[0];
  if (top) return top[0];
  const c = cscByName.get(key(name));
  return c ? c.iso2 : null;
});
const cc = ccIso.map((iso) => fa(byIso2.get(iso)));

// second pass, now that each city's country is known: a name that occurs once
// in that country is the same place even when the source misplaces it
// (its Copenhagen sits ~90 degrees west)
const uniqueInCountry = new Map();
for (const [k, list] of cityIdx) {
  const per = new Map();
  for (const c of list) per.set(c.country_code, per.has(c.country_code) ? null : c);
  for (const [iso, c] of per) if (c) uniqueInCountry.set(`${iso}|${k}`, c);
}
SEARCH_CITIES.forEach((s, i) => {
  if (cities[i] || !ccIso[s.s]) return;
  const c = uniqueInCountry.get(`${ccIso[s.s]}|${key(s.n)}`);
  if (c) cities[i] = fa(c);
});

// Notable cities the source spells differently or leaves out. Keyed by the
// English gazetteer name and its country.
const OVERRIDES = {
  'Jakarta|Indonesia': 'جاکارتا', 'Bogotá|Colombia': 'بوگوتا', 'Hong Kong|Hong Kong': 'هنگ کنگ',
  'Hanoi|Vietnam': 'هانوی', 'Nouakchott|Mauritania': 'نواکشوت', 'Makkah|Saudi Arabia': 'مکه',
  'Madinah|Saudi Arabia': 'مدینه', 'Ciudad Juárez|Mexico': 'سیوداد خوارس',
  'Washington|United States': 'واشنگتن', 'Prayagraj|India': 'پریاگراج',
  'Rostov-on-Don|Russia': 'روستوف-نا-دونو', 'Nuremberg|Germany': 'نورنبرگ', 'Gothenburg|Sweden': 'گوتنبرگ',
  'Macau|Macao': 'ماکائو', 'Taiz|Yemen': 'تعز', 'Zaporizhzhya|Ukraine': 'زاپروژیا',
  'Kryvyy Rih|Ukraine': 'کریوی ریه', 'Orūmīyeh|Iran': 'ارومیه', 'Mar del Plata|Argentina': 'مار دل پلاتا',
  'Pokhara|Nepal': 'پوخارا', 'Cartagena|Colombia': 'کارتاخنا', 'Changsha|China': 'چانگشا',
};
const seen = new Set();
SEARCH_CITIES.forEach((s, i) => {
  const k = `${s.n}|${SEARCH_CC[s.s]}`;
  if (OVERRIDES[k] && !seen.has(k)) { cities[i] = OVERRIDES[k]; seen.add(k); } // first (largest) only
});
for (const k of Object.keys(OVERRIDES)) if (!seen.has(k)) console.warn('override matches no gazetteer city:', k);

// North Macedonia's source entry is one of the reversed ones above; the rest
// are places the source has no country entry for.
const COUNTRY_OVERRIDES = {
  'North Macedonia': 'مقدونیه شمالی', Macedonia: 'مقدونیه شمالی', Kosovo: 'کوزوو',
  'Northern Cyprus': 'قبرس شمالی', Somaliland: 'سومالی‌لند', Macao: 'ماکائو', 'Isle of Man': 'جزیره من',
};
SEARCH_COUNTRIES.forEach((c, i) => { if (!countries[i] && COUNTRY_OVERRIDES[c.n]) countries[i] = COUNTRY_OVERRIDES[c.n]; });
SEARCH_CC.forEach((n, i) => { if (!cc[i] && COUNTRY_OVERRIDES[n]) cc[i] = COUNTRY_OVERRIDES[n]; });

// regions: same country, same name with or without the generic words
const stateIdx = new Map();
for (const s of cscStates) {
  if (!fa(s)) continue;
  for (const k of new Set([key(s.name), rkey(s.name)])) {
    const kk = `${s.country_code}|${k}`;
    if (!stateIdx.has(kk)) stateIdx.set(kk, s);
  }
}
const regions = SEARCH_REGIONS.map((r) => {
  const iso = ccIso[r.s];
  if (!iso) return '';
  const s = stateIdx.get(`${iso}|${key(r.n)}`) || stateIdx.get(`${iso}|${rkey(r.n)}`);
  return s ? fa(s) : '';
});

const out = {
  source: 'Data by Countries States Cities Database, https://github.com/dr5hn/countries-states-cities-database | ODbL v1.0',
  n: [SEARCH_COUNTRIES.length, SEARCH_CC.length, SEARCH_REGIONS.length, SEARCH_CITIES.length],
  countries, cc, regions, cities };
fs.writeFileSync(path.join(dir, '..', 'search-fa.json'), JSON.stringify(out));
const pct = (a) => `${a.filter(Boolean).length}/${a.length}`;
console.log('fa names — countries', pct(countries), 'cc', pct(cc), 'regions', pct(regions), 'cities', pct(cities),
  'size', (fs.statSync(path.join(dir, '..', 'search-fa.json')).size / 1024).toFixed(1) + 'KB');
