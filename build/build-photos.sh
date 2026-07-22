#!/bin/zsh
# Fetch lead images for location articles from Wikipedia into photos/<key>.jpg.
# Idempotent: existing photos are kept — delete a file to re-fetch it.
set -u
cd "$(dirname "$0")"
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
)

for key in ${(k)titles}; do
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
