# Grandis Legacy — PvP Season 0 RC42 — PvP Part 6 handoff

Date: 24 November 2026  |  Target branch/repository: user-deployed Grandis Legacy Season 0 PvP  |  Release status: **RC42 test handoff (not Stable)**.

## Delivery: exactly two independent ZIPs

1. **Standalone PvP:** `Grandis_Legacy_PvP_RC42_2026-11-24.zip` — a single clean-root project directory with `server.js`, `server/`, `public/`, `package.json`, `package-lock.json`, `Dockerfile`, QA tests, scripts, docs and full local Season 0 assets. Runs as a separate backend; does not require the website repository.
2. **Website PvP folder:** `Grandis_Legacy_Website_PvP_RC42_2026-11-24.zip` — a single top-level `pvp/` directory containing only PvP client files. Unzip into the existing **website root** as `/pvp/`. Does not contain a backend, `/card-art/` mirror, or overwrite the existing root assets or other games.

Both packages share the exact protocol build ID `gl-s0-pvp-rc42-r398-r40-20261124-b` and must be deployed together.

## Source authority and changes

- Standalone base: PvP Season 0 RC41 F19 stable integration from 21 November 2026, **not** its Server 1/Season 1 source.
- Approved donor: VS AI Season 0 RC42 from 24 November 2026. Integrated its RC42 changes in `app.bundle.js`, `app-runtime.js`, responsive game CSS and mobile lobby code, retaining **two-seat authority**, secret filtering, Response window, revision/ACK, reconnect, seat/session identity and one parent-owned WebSocket through the gameplay iframe.
- Updated 5 currently approved starter decks, R3.98 Main Deck RC42 overlay and matching print/review data (including `S0-EVT-013` and `S0-ITM-021`). Existing Legacy R4.0 and Rulebook v3.5 semantics preserved.
- Added/fixed server-side Import Deck normalization and atomic validation: supports accepted Deck Builder shapes, 50 Main / 12 Legacy, three legal Hero packages, rejects malformed imports without mutating the stored player deck. The lobby only persists imports after a validated server snapshot.
- RC42 mobile: donor card-list touch scroll, responsive phase row at 46.8px on adaptive stage, card/preview outside-tap handling, mobile lobby/game HUD improvements with PvP whole-body/iframe orientation preserved.
- Fixed lobby battle asset preload URLs to point to the actual `/battle/engine/assets/...` directories; website equivalents point to `/pvp/battle/engine/assets/...`.
- Website uses existing shared `/card-art/` (250 WebP files in supplied website root), shared favicon, shared logo, analytics and navigation. Website frontend WebSocket is configured in `pvp/config.js` and carries the same version stamp as the standalone backend.

## Installation and coexistence

**Backend:** Extract the standalone ZIP, open its only project directory and deploy as the **standalone PvP service** (Northflank or compatible Node 22 Docker). Install `ws` from pinned lockfile. Set `PVP_REQUIRE_WS=1`. Keep one replica. Verify `GET /health` and its `buildId`.

**Website:** Extract the second ZIP into the Grandis Legacy website repository root. It has **one folder, `pvp`**, and no root `index.html`, `/card-art`, other app folders, or website global assets. It relies on shared files already in the 24 November Website FULL_NO_PVP baseline. For existing site layout it serves `https://grandislegacytcg.web.id/pvp/`. Backend WebSocket is currently configured as `wss://p01--grandis-legacy-s0-pvp--2kwws8nzlcc2.code.run/ws`; verify this is the current RC42 backend endpoint or change `pvp/config.js` before publishing.

**No automated publishing:** No git commit, push, GitHub upload, or Northflank/website deployment was performed.

## Offline checks run on the source

- `npm run check`: **PASS**; includes syntax checks, RC42 headless setup/content, scripted HTTP/WebSocket Import Deck acceptance & rejection, 2 real WebSocket connections in local process, verified coin flip/first turn, stale revision rejection, viewer masking, match end; RC41 reusable smoke, mirrored seat+Mana tests, privacy, RC6 one-socket/bridge, F15 card interaction and deterministic choice, Search-to-Hand + Card Played.
- 244/244 RC42 overlay approved card-art SHA-256 hashes match both the standalone's local artwork and the supplied website-root shared `/card-art/` folder. All 250 artwork files exist.
- Website staging HTML relative/absolute static references checked against the delivered `/pvp/` tree and the supplied full website root: no missing assets in referenced tags.
- Brotli / Gzip sidecars were regenerated from current source so old `.br`/`.gz` bytecode is not served.

**Limitations/remaining human acceptance**

- Automated browser rendering could not start in the isolated environment (`net::ERR_BLOCKED_BY_ADMINISTRATOR`, including local and data URLs). Therefore visual screenshots, real touch gesture QA, Hand Back-of-Card stacking and same-device mobile/browser performance are **not verified**.
- Scripted multi-seat WebSocket checks do not replace two distinct real browsers playing a match against deployed native-`ws` in Northflank. Cloud rollout, real WSS/Origin, deck import UI and all Status/Response card branches require final QA after manual deployment.
- Some archived RC41 tests depend on byte-frozen RC41 hashes, RC41-specific print fixtures or old swap targeting and intentionally **cannot certify** the newer approved RC42 source. Current RC42 targeted tests are the active `npm run check` release gate. Archived scripts remain available for baseline-only comparisons.

## Recommended manual acceptance sequence

Start two isolated browser tabs or browsers (one per seat), import an official Deck Builder 50/12 JSON, Ready both, Start Match, complete coin and choose first turn, then verify card visuals and Seat 2 targets, Mana cost, Response, Exhaust, attack/dodge/block, Status/Poison, Racial/Legacy, Rank Up, Card Played and Search-to-Hand. Check spectators never reveal hidden Hand/deck contents. Repeat on narrow desktop, mobile landscape and rotated mobile portrait; test touch scrolling, preview outside tap, audio and hand overlays. Verify reconnection and match return to lobby. Check both clients and backend `/health` expose the same build ID.
