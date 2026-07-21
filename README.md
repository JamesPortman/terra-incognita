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

## Live rooms (multiplayer)

Kahoot-style rooms for up to 14 players: the host opens a room on a big screen,
players join with a 4-letter code (or `/?join=CODE`) on their phones, everyone
guesses the same locations under one timer, and reveals show all pins.

- **Room state** lives in Upstash Redis (`api/_lib/store.js`) with a 4-hour TTL.
  Locally, without Redis env vars, a file-based store in the temp dir is used.
- **Scoring is server-side** (`api/guess.js`) against `shared/locations.js` —
  the same array embedded in the client; order must stay in sync (rebuild after edits).
- **All-time leaderboard** persists to Neon Postgres (`leaderboard` table,
  auto-created); rows are written once per game when the host ends it.
- Rounds auto-advance to reveal when every player has answered or 45s elapses
  (lazy transition in `api/state.js`); clients poll every 1.5s.

## Tests

```bash
npm test          # Vitest unit tests (scoring, room codes, store, API handlers)
npm run test:e2e  # Playwright E2E (starts `vercel dev` on :3300 automatically)
```

- Unit tests run the real `api/` handlers against the file-based dev store —
  no Redis or network needed; the final-transition test uses zero players so
  nothing is written to Neon.
- E2E covers the menu, a full solo game (including the round timeout), map
  search, and a two-browser live room. Player names prefixed `E2E-` are
  filtered out of the persistent leaderboard server-side, so test games leave
  nothing behind. Most specs run with `?plainmap=1` (SVG guess map) for
  determinism; one spec exercises the real Google map. Street View stays off
  in E2E so tests don't consume Google quota.

Admin: the leaderboard screen has an Admin section (token in `ADMIN_TOKEN`,
see `.env.local`) that can clear the all-time leaderboard via `/api/admin`.

## Deploy

Static site + `api/` functions on Vercel. Push to `main` to deploy.
Integrations: Neon (`DATABASE_URL`) and Upstash Redis (`KV_REST_API_*` /
`UPSTASH_REDIS_REST_*`) via the Vercel Marketplace.
