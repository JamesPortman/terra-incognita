# Terra Incognita

A GeoGuessr-style guessing game: each round shows a photo of a real place; drop a pin
on the world map and score up to 5,000 points per round based on distance (5 rounds).

Fully self-contained — `index.html` has the world map (SVG paths from GeoJSON) and all
20 location photos (Wikimedia Commons) inlined, so it runs with no network access.

## Editing the game

Game logic and styling live in `build/game-template.html`. To rebuild `index.html`:

```bash
node build/assemble.js                     # writes build/terra-incognita.html
cp build/terra-incognita.html index.html
```

- `build/map-data.js` — generated SVG world map (regenerate with `build/build-map.js`,
  which needs `countries.geo.json` from https://github.com/johan/world.geo.json)
- `build/photos/` — location photos; `build/build-photos.sh` re-fetches them from
  Wikipedia. Add a location by adding a photo + an entry in `LOCS` in `build/assemble.js`.

## Deploy

Static site on Vercel. Push to `main` to deploy.
