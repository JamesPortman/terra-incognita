#!/bin/zsh
# Fetch lead images for location articles from Wikipedia into photos/<key>.jpg
# at the repo root — the directory the site serves; there is no second copy.
# Idempotent: existing photos are kept — delete a file to re-fetch it.
# The titles below are also the source of build/photo-credits.json: after adding
# a location, run `node build/build-credits.js --fetch` so its photo is credited.
set -u
cd "$(dirname "$0")/.."
mkdir -p photos

typeset -A titles
titles=(
  shibuya "Shibuya Crossing"
  timessquare "Times Square"
  oia "Oia,_Greece"
  machupicchu "Machu Picchu"
  sydneyopera "Sydney Opera House"
  tablemountain "Table Mountain"
  redsquare "Red Square"
  eiffel "Eiffel Tower"
  rio "Christ the Redeemer (statue)"
  goldengate "Golden Gate Bridge"
  petra "Petra"
  tajmahal "Taj Mahal"
  colosseum "Colosseum"
  chichenitza "Chichen Itza"
  moraine "Moraine Lake"
  halong "Ha Long Bay"
  reykjavik "Hallgrímskirkja"
  dubai "Burj Khalifa"
  marrakesh "Jemaa el-Fnaa"
  greatwall "Mutianyu"
  stonehenge "Stonehenge"
  neuschwanstein "Neuschwanstein Castle"
  sagrada "Sagrada Família"
  angkor "Angkor Wat"
  fuji "Mount Fuji"
  niagara "Niagara Falls"
  liberty "Statue of Liberty"
  goldentemple "Golden Temple"
  bigben "Big Ben"
  brandenburg "Brandenburg Gate"
  acropolis "Acropolis of Athens"
  uluru "Uluru"
  grandcanyon "Grand Canyon"
  victoriafalls "Victoria Falls"
  giza "Great Pyramid of Giza"
  bluemosque "Sultan Ahmed Mosque"
  charlesbridge "Charles Bridge"
  kinkakuji "Kinkaku-ji"
  gardensbay "Gardens by the Bay"
  victoriapeak "Victoria Peak"
  torresdelpaine "Torres del Paine National Park"
  uyuni "Salar de Uyuni"
  cappadocia "Cappadocia"
  positano "Positano"
  matterhorn "Matterhorn"
  cliffsofmoher "Cliffs of Moher"
  plitvice "Plitvice Lakes National Park"
  borabora "Bora Bora"
  lofoten "Lofoten"
  watarun "Wat Arun"
  mountrushmore "Mount Rushmore"
  elcapitan "El Capitan"
  oldfaithful "Old Faithful"
  spaceneedle "Space Needle"
  gatewayarch "Gateway Arch"
  whitehouse "White House"
  hollywoodsign "Hollywood Sign"
  lasvegasstrip "Las Vegas Strip"
  frenchquarter "French Quarter"
  antelopecanyon "Antelope Canyon"
  monumentvalley "Monument Valley"
  denali "Denali"
  brooklynbridge "Brooklyn Bridge"
  cloudgate "Millennium Park"
  lakelouise "Lake Louise (Alberta)"
  cntower "CN Tower"
  chateaufrontenac "Château Frontenac"
  peggyscove "Peggys Cove"
  parliamenthill "Parliament Hill, Ottawa"
  capilano "Capilano Suspension Bridge"
  percerock "Percé Rock"
  tulum "Tulum"
  teotihuacan "Teotihuacan"
  cabosanlucas "Arch of Cabo San Lucas"
  zocalo "Zócalo"
  guanajuato "Guanajuato (city)"
  tikal "Tikal"
  arenal "Arenal Volcano"
  panamacanal "Panama Canal"
  oldhavana "Old Havana"
  iguazufalls "Iguazu Falls"
  peritomoreno "Perito Moreno Glacier"
  obelisco "Obelisco de Buenos Aires"
  caminito "Caminito"
  fitzroy "Fitz Roy"
  bariloche "San Carlos de Bariloche"
  sugarloaf "Sugarloaf Mountain"
  copacabana "Copacabana, Rio de Janeiro"
  amazontheatre "Amazon Theatre"
  pelourinho "Pelourinho"
  lencois "Lençóis Maranhenses National Park"
  brasilia "Cathedral of Brasília"
  cartagena "Cartagena, Colombia"
  cocora "Cocora Valley"
  guatape "El Peñón de Guatapé"
  cusco "Cusco"
  rainbowmountain "Vinicunca"
  nazca "Nazca lines"
  arequipa "Arequipa"
  titicaca "Lake Titicaca"
  galapagos "Galápagos Islands"
  quito "Quito"
  cotopaxi "Cotopaxi"
  angelfalls "Angel Falls"
  roraima "Mount Roraima"
  atacama "Valle de la Luna (Chile)"
  easterisland "Moai"
  valparaiso "Valparaíso"
  montevideo "Palacio Salvo"
  lamano "La Mano de Punta del Este"
  chiloe "Churches of Chiloé"
  brycecanyon "Bryce Canyon National Park"
  keywest "Key West"
  rockefeller "Rockefeller Center"
  alcatraz "Alcatraz Island"
  mesaverde "Mesa Verde National Park"
  kennedyspace "Kennedy Space Center"
  signalhill "Signal Hill, St. John's"
  athabascafalls "Athabasca Falls"
  hopewellrocks "Hopewell Rocks"
  notredamemtl "Notre-Dame Basilica (Montreal)"
  coppercanyon "Copper Canyon"
  palenque "Palenque"
  oldsanjuan "Old San Juan"
  maracana "Maracanã Stadium"
  paraty "Paraty"
  fernandodenoronha "Fernando de Noronha"
  chapada "Chapada Diamantina National Park"
  monserrate "Monserrate"
  tayrona "Tayrona National Natural Park"
  huacachina "Huacachina"
  colcacanyon "Colca Canyon"
  sacsayhuaman "Sacsayhuamán"
  ollantaytambo "Ollantaytambo"
  banos "Baños de Agua Santa"
  quilotoa "Quilotoa"
  canaima "Canaima National Park"
  ushuaia "Ushuaia"
  lapaz "La Paz"
  empirestate "Empire State Building"
  centralpark "Central Park"
  lincolnmemorial "Lincoln Memorial"
  uscapitol "United States Capitol"
  libertybell "Liberty Bell"
  fenway "Fenway Park"
  fishermanswharf "Fisherman's Wharf, San Francisco"
  santamonicapier "Santa Monica Pier"
  griffith "Griffith Observatory"
  magickingdom "Magic Kingdom"
  southbeach "South Beach"
  bealestreet "Beale Street"
  nashvillebroadway "Broadway (Nashville, Tennessee)"
  riverwalk "San Antonio River Walk"
  thealamo "Alamo Mission"
  navypier "Navy Pier"
  willistower "Willis Tower"
  jeffersonmemorial "Jefferson Memorial"
  lombardstreet "Lombard Street (San Francisco)"
  pikeplace "Pike Place Market"
  multnomah "Multnomah Falls"
  zion "Zion National Park"
  delicatearch "Delicate Arch"
  horseshoebend "Horseshoe Bend (Arizona)"
  waikiki "Waikiki"
  escadaria "Escadaria Selarón"
  ipanema "Ipanema"
  lapa "Carioca Aqueduct"
  niteroi "Niterói Contemporary Art Museum"
  secathedral "São Paulo Cathedral"
  masp "São Paulo Museum of Art"
  ibirapuera "Ibirapuera Park"
  ouropreto "Ouro Preto"
  congonhas "Sanctuary of Bom Jesus do Congonhas"
  inhotim "Inhotim"
  pampulha "Pampulha Modern Ensemble"
  olinda "Olinda"
  portodegalinhas "Porto de Galinhas"
  jericoacoara "Jericoacoara"
  saoluis "São Luís, Maranhão"
  alterdochao "Alter do Chão, Pará"
  meetingofwaters "Meeting of Waters"
  pantanal "Pantanal"
  bonito "Bonito, Mato Grosso do Sul"
  chapadaguimaraes "Chapada dos Guimarães National Park"
  veadeiros "Chapada dos Veadeiros National Park"
  jalapao "Jalapão"
  pipa "Praia da Pipa"
  genipabu "Genipabu"
  canoaquebrada "Canoa Quebrada"
  maragogi "Maragogi"
  lacerda "Lacerda Elevator"
  trancoso "Trancoso, Bahia"
  curitibabotanic "Botanical Garden of Curitiba"
  hercilioluz "Hercílio Luz Bridge"
  gramado "Gramado"
  caracol "Caracol Falls"
  itaimbezinho "Aparados da Serra National Park"
  serraorgaos "Serra dos Órgãos"
  petropolis "Imperial Museum of Brazil"
  buzios "Armação dos Búzios"
  ilhagrande "Ilha Grande"
  itaipu "Itaipu Dam"
)

# Some articles' lead image is a logo, a map or a sign that names the place,
# which gives the round away. For these, search Wikimedia Commons instead and
# take the first photo whose file name isn't a logo/map/sign/flag/seal (and
# isn't an SVG/PNG or under 800 px wide). A value starting "File:" pins that
# exact Commons file. The file chosen is recorded in build/photo-overrides.json,
# which build-credits.js credits in place of the article's lead image.
# To re-pick one: delete photos/<key>.jpg, edit its query (or pin a File:), rerun.
typeset -A photoquery
photoquery=(
  cntower "CN Tower Toronto skyline"
  rockefeller "30 Rockefeller Plaza building"
  montevideo "Palacio Salvo Montevideo"
  kennedyspace "Kennedy Space Center Launch Complex 39A"
  fishermanswharf "Fisherman's Wharf San Francisco boats"
  santamonicapier "Santa Monica Pier Ferris wheel"
  panamacanal "Miraflores Locks ship Panama Canal"
  oldhavana "Old Havana street"
  jericoacoara "Jericoacoara beach dune"
)
OVERRIDES=build/photo-overrides.json
[[ -s $OVERRIDES ]] || echo '{}' > $OVERRIDES

# Prints "<file name>\t<thumbnail url>" for a Commons search, or for a pinned File:.
commons_pick() {
  python3 - "$1" <<'PY'
import json, re, sys, urllib.parse, urllib.request
q = sys.argv[1]
UA = {"User-Agent": "GeoGame-build/1.0 (james@portman.ca)"}
def get(params):
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({**params, "format": "json"})
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30))
info = {"prop": "imageinfo", "iiprop": "url|size", "iiurlwidth": "1100"}
if q.startswith("File:"):
    pages = get({"action": "query", "titles": q, **info})["query"]["pages"].values()
else:
    d = get({"action": "query", "generator": "search", "gsrnamespace": "6",
             "gsrsearch": q + " filetype:bitmap", "gsrlimit": "30", **info})
    pages = sorted(d.get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 0))
bad = re.compile(r"logo|map|sign|flag|seal|coat of arms|emblem|locator|diagram|plan\b|plano|mapa|carte|karte|\.(svg|png|gif|tiff?)$", re.I)
for p in pages:
    ii = (p.get("imageinfo") or [{}])[0]
    name = p["title"][len("File:"):]
    if not ii.get("thumburl"):
        continue
    if not q.startswith("File:") and (bad.search(name) or ii.get("width", 0) < 800):
        continue
    print(name + "\t" + ii["thumburl"])
    break
PY
}

for key in ${(k)titles}; do
  if [[ -n "${photoquery[$key]:-}" ]]; then
    if [[ -s "photos/${key}.jpg" ]] && python3 -c "import json,sys;sys.exit(0 if sys.argv[1] in json.load(open('$OVERRIDES')) else 1)" "$key"; then
      echo "KEEP  $key (override)"
      continue
    fi
    pick=$(commons_pick "${photoquery[$key]}" 2>/dev/null)
    if [[ -z "$pick" ]]; then
      echo "MISS  $key (no Commons photo for: ${photoquery[$key]})"
      continue
    fi
    file=${pick%%$'\t'*}; url=${pick#*$'\t'}
    curl -sL -A "GeoGame-build/1.0 (james@portman.ca)" -o "photos/${key}.raw" "$url"
    sips -Z 900 -s format jpeg -s formatOptions 55 "photos/${key}.raw" --out "photos/${key}.jpg" >/dev/null 2>&1
    rm -f "photos/${key}.raw"
    if [[ -s "photos/${key}.jpg" ]]; then
      python3 -c "import json,sys;p=sys.argv[1];d=json.load(open(p));d[sys.argv[2]]=sys.argv[3];open(p,'w').write(json.dumps(dict(sorted(d.items())),indent=2,ensure_ascii=False)+'\n')" "$OVERRIDES" "$key" "$file"
      echo "OK    $key  ← $file"
    else
      echo "FAIL  $key ($url)"
    fi
    sleep 1
    continue
  fi
  if [[ -s "photos/${key}.jpg" ]]; then
    echo "KEEP  $key"
    continue
  fi
  title=${titles[$key]}
  enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$title")
  url=$(curl -sL -A "GeoGame-build/1.0 (james@portman.ca)" "https://en.wikipedia.org/w/api.php?action=query&titles=${enc}&prop=pageimages&piprop=thumbnail&pithumbsize=1100&format=json&redirects=1" \
    | python3 -c "import json,sys;d=json.load(sys.stdin);p=list(d['query']['pages'].values())[0];print(p.get('thumbnail',{}).get('source',''))" 2>/dev/null)
  if [[ -z "$url" ]]; then
    echo "MISS  $key ($title)"
    continue
  fi
  curl -sL -A "GeoGame-build/1.0 (james@portman.ca)" -o "photos/${key}.raw" "$url"
  sips -Z 900 -s format jpeg -s formatOptions 55 "photos/${key}.raw" --out "photos/${key}.jpg" >/dev/null 2>&1
  rm -f "photos/${key}.raw"
  if [[ -s "photos/${key}.jpg" ]]; then
    echo "OK    $key  $(du -k photos/${key}.jpg | cut -f1)KB"
  else
    echo "FAIL  $key ($url)"
  fi
  sleep 1
done
