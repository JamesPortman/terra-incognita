#!/bin/zsh
# Fetch lead images for location articles from Wikipedia, downscale, save as photos/<key>.jpg
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
)

for key in ${(k)titles}; do
  title=${titles[$key]}
  enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$title")
  url=$(curl -sL "https://en.wikipedia.org/w/api.php?action=query&titles=${enc}&prop=pageimages&piprop=thumbnail&pithumbsize=1100&format=json&redirects=1" \
    | python3 -c "import json,sys;d=json.load(sys.stdin);p=list(d['query']['pages'].values())[0];print(p.get('thumbnail',{}).get('source',''))")
  if [[ -z "$url" ]]; then
    echo "MISS  $key ($title)"
    continue
  fi
  curl -sL -A "GeoGame-build/1.0 (james@portman.ca)" -o "photos/${key}.raw" "$url"
  sips -Z 1000 -s format jpeg -s formatOptions 65 "photos/${key}.raw" --out "photos/${key}.jpg" >/dev/null 2>&1
  rm -f "photos/${key}.raw"
  if [[ -s "photos/${key}.jpg" ]]; then
    echo "OK    $key  $(du -k photos/${key}.jpg | cut -f1)KB"
  else
    echo "FAIL  $key ($url)"
  fi
done
