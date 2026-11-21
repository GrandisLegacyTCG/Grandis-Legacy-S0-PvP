# Grandis Legacy Season 0 PvP RC41 — Part 5 release

**Deploy only to `GrandisLegacyTCG/Grandis-Legacy-S0-PvP` on `main` (Season 0).** Do not touch the separate Season 1 repository `Grandis-Legacy-PvP`.

## Base and source of truth
- Backend base: full PvP-Trial RC40 Patch 3.2 (17 Nov 2026) retaining server authority, room state, WebSocket, rejoin, and privacy.
- Gameplay donor: **VS AI Season 0 RC41** (18 Nov 2026). Three JS donor modules are SHA-256 byte-identical. The donor's `app.bundle.js` has an audited set of PvP-only adaptations (see `docs/RC41_DONOR_SOURCE_AUDIT.json`).
- Cards: Main/Legacy R3.9 and Player Rulebook v3.4. Five RC41 starter decks synced across lobby, headless authority and game runtime.
- Preserve RC40's existing PvP net paths but repair physical Mana seat mirroring, Provoke End Phase resume, side-stamped history flags, duplicate mirrored Rank Up notices, PvP Mana-loss notifications and exact Mana/Response selections.

## Assets and website integration
- Backend is standalone and has **one copy** of the 248 Season 0 card artworks at `public/battle/card-art/`.
- Website-root `/pvp/` ZIP has **no card artwork duplicates**. It uses the shared website root `/card-art/` and `/assets/js/s0-artwork-fallback.js`; 248/248 artwork digests match Website RC41.
- Website `/pvp/config.js` points to the configured remote WSS backend; the backend's own `/config.js` remains same-origin for standalone operation.
- Website and backend gameplay bundles are identical after normalizing website-only `/card-art/` URLs; other critical network files match byte-for-byte.

## Executable QA
- `npm run check:rc41`: syntax, donor integrity, 5 starter decks, card overlays, 20/20 RC41 gameplay regressions, both-seat headless turns, physical Mana mirrors, seat2 PAY/Response, WebSocket sessions/reconnect/origin gating.
- `npm run check`: all of the above **plus 50 independent retained PvP compatibility/network tests**. Last verified 50/50; test outputs in `docs/RC41_RELEASE_GATE_RESULTS.json`.
- Optional browser viewport fixture: `python3 tests/qa-opponent-mana-browser.py` (4/4 Chrome viewport geometry validations locally).
- `npm run build:precompress` regenerates HTTP `.br`/`.gz` without changing authoritative game sources.

## Historical tests and limitations
- Older RC40 test fixtures asserting frozen **RC40 SHA-256 hashes and R3.7 printed cards** are preserved for historical comparison; they are NOT equivalent to current RC41 donor assertions and therefore are not part of the RC41 CI release gate. See `docs/RC41_DONOR_SOURCE_AUDIT.json` and current 50-test gate. Do not present their obsolete expectations as RC41 failures.
- Local QA exercises native gameplay engine and live two-client WebSockets via bundled fallback `ws-lite`, NOT the production `ws` npm transport. GitHub Actions runs `npm ci`, Docker build and native WebSocket health check after upload.
- A real deployed Northflank + two-browser, full-match gameplay run was **not** performed in this local environment. Live deployment validation is still required after upload; do not claim that this source ZIP is proof of production availability.

## Manual upload order
1. Replace **only** the `Grandis-Legacy-S0-PvP` Season 0 backend repo with the contents of the backend ZIP, deploy the service, confirm `/health` reports RC41 build ID and WebSocket transport `ws`.
2. Merge the website ZIP's **`pvp/` folder** into `Grandis-Legacy-S0-Website` repository root. Do not remove or overwrite root `card-art/`, `assets/`, `vs-ai/`, `deck-builder/`, or homepage.
3. Open `/pvp/` in two distinct browsers, start match, verify turn/Response/EXP/payment/reconnect and asset loading. Never change the Season 1 PvP repo.

## 20 November 2026 — S0 repository rename, WebSocket migration and donor mobile adaptation
- Canonical backend: `GrandisLegacyTCG/Grandis-Legacy-S0-PvP`, `main`. Website: `GrandisLegacyTCG/Grandis-Legacy-S0-Website`, `main`. **Do not change `Grandis-Legacy-PvP` (Season 1)**.
- Current Northflank service: `Grandis Legacy S0 PvP` (`wss://p01--grandis-legacy-s0-pvp--2kwws8nzlcc2.code.run/ws`). The website `/pvp/config.js` owns this external endpoint; standalone backend `/config.js` is same-origin and remains unchanged.
- **No version/buildId change**. This package takes from the 20 Nov VS AI Season 0 donor **compatible MOBILE presentation only**: portrait card preview placement/size. The standalone PvP body already rotates the whole 1600x747 stage, so the VS AI viewport-specific flying-card coordinate transform and AI decision policy MUST NOT be copied. Core gameplay, card data and network authority are unchanged.
- Required website-root assets for the updated `/pvp/` overlay: `/assets/css/gl-site-brand.css`, `/assets/css/gl-site-navigation.css`, `/assets/js/gl-site-analytics.js`, `/assets/js/s0-artwork-fallback.js`, `/assets/site/web-s0/logo-transparent.webp`, existing `/card-art/`, and other 109 SHA-verified shared assets. **Do not duplicate root assets in `/pvp/`**.
- Historical docs still reference pre-rename repos and Room2 as history only; they are NOT deployment instructions. Room2 must remain available as fallback. See `docs/S0_PVP_20261120_HANDOFF.md` for the latest manual handoff.
