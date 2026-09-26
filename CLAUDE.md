# CLAUDE.md — Terra Incognita

GeoGuessr-style game. Static `index.html` (built artifact) + Vercel Functions.
See `/architecture` (architecture.html) for the full system reference.

## Build & test

```bash
node build/assemble.js   # writes index.html + credits.html, stamps version.txt
npm test          # Vitest + coverage floor (fails below thresholds)
npm run test:e2e  # Playwright vs `vercel dev` on :3300
```

Edit `build/game-template.html`, never `index.html` or `credits.html` directly
(both are generated and committed; they are what Vercel serves). `photos/` is
the only copy of the photos — there is no `build/photos/`. Deploys go
through GitHub Actions only (both suites gate `vercel deploy`); Vercel git
auto-deploy is off.

## Pre-commit checklist — every change, before every build

1. **New/changed server code** (`api/`, `shared/`): add or extend unit tests in
   `__tests__/`. The coverage thresholds in `vitest.config.mjs` are a floor —
   raise them as coverage improves; never lower them to get a build through.
2. **New/changed user-visible behavior**: add or extend a Playwright spec in
   `e2e/`. Default to `?plainmap=1` (deterministic SVG map); Google-dependent
   flows belong in `gmap.spec.js`. E2E player names MUST start with `E2E-`
   (the server filters them out of the leaderboard).
3. Run `npm test` locally before pushing; run the affected E2E spec too.
4. If behavior described on `/architecture` changed, update architecture.html
   in the same commit.

## Gotchas

- The @upstash/redis SDK serializes JSON itself — store plain objects, never
  pre-stringify (double-encoding crashes hgetall consumers).
- Google Maps/Street View containers must be visible (not display:none) when
  constructed, or trigger a resize after showing them.
- The embedded browser pane used by Claude reports `visibilityState: "hidden"`,
  so Google Maps won't render there — verify map behavior via Playwright.
- `shared/locations.js` order is a contract between the embedded client decks
  and server-side scoring — APPEND-ONLY; deck membership lives in
  `shared/decks.js` (world/na/sa key lists) and can change freely. Rebuild
  index.html after any change.
- The photos are third-party (Wikimedia Commons, mostly CC BY-SA), not ours:
  every one needs a credit. A new location needs its article title in
  `build/build-photos.sh` and an entry in `build/photo-credits.json`
  (`node build/build-credits.js --fetch`); assemble.js refuses to build without
  it and `__tests__/credits.test.js` checks the page. Never invent authors or
  licences. A round photo must not name its answer: when an article's lead
  image is a logo, map or sign, add the key to `photoquery` in
  build-photos.sh (a Commons search, or a pinned `File:`); the chosen file is
  recorded in `build/photo-overrides.json` and credited from there. Code is MIT (`LICENSE`); `NOTICE` lists what isn't.
- Local dev uses the real production Neon + Upstash (env from `.env.local`);
  clean up any non-`E2E-` test data you create.
- The game is served both at a domain root and under `/terra-incognita` (proxied
  by portman.ca). New fetches and page links must go through `BASE` or be
  relative — never root-absolute. `e2e/subpath.spec.js` covers both forms.
