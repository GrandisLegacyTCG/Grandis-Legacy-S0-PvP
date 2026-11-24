# Grandis Legacy Season 0 - PvP RC42 (24 November 2026)

**Package:** Standalone authoritative PvP backend, not a website root patch.  The separate Website ZIP installs **only `pvp/`** at the existing Grandis Legacy website root.  No Season 1 runtime or existing website root files are replaced.

**Current authority:** Season 0 Player Rulebook v3.5; Main Deck R3.98; Legacy Deck R4.0; approved VS AI RC42 (gameplay/UI donor). Network RC6 Stage 2 stays server-authoritative. Build ID: `gl-s0-pvp-rc42-r398-r40-20261124-b`.

## Run locally

Requires Node.js 22 and a network connection for the pinned dependency on initial install:

```sh
npm ci --omit=dev --ignore-scripts --no-audit --no-fund
npm start
```

Open `http://localhost:3000/` for the PvP lobby. The server hosts `/battle/`, `/ws`, `/health` and all standalone assets. Run `npm run check` for the consolidated RC42 offline and two-seat network test suite. `npm run build:precompress` regenerates static Brotli/GZip sidecars if any public script or style is modified.

## Production deployment (manual, not performed by this release)

- Use `Dockerfile`, with `PVP_REQUIRE_WS=1` for mandatory native `ws` production transport and `PORT` supplied by the host.
- Keep **one live replica** while room and match state remain in process memory.
- Allow the live website Origin with `PVP_ALLOWED_ORIGINS=https://grandislegacytcg.web.id`; the server also recognizes this official origin.
- After deploying backend, confirm `/health` returns build ID `gl-s0-pvp-rc42-r398-r40-20261124-b`. Ensure the Website `/pvp/config.js` `wsBase` points at the actual active **RC42** backend hostname. Update it if the hostname changes before uploading website files.
- Copy the **contents** of the Website ZIP to the existing website repository root; it contains `pvp/index.html`, `pvp/battle/`, etc. It references existing website `/card-art/`, `/assets/site/web-s0/` and `/assets/js/`. Do **not** unpack this standalone backend into the website repository.
- Deploy backend and website as one matching build. Reconnect/reload clients to pick up the new build. Do not let a new RC42 frontend talk to an old RC41 authority (build IDs are validated).

**QA scope:** `npm run check` passed, including scripted two-seat WebSocket setup, server coin-flip, first turn, snapshot privacy, rejected stale intents, surrender and final match state. This is not a complete interactive two-physical-browser or production Northflank/WSS acceptance. Browser visual/mobile fidelity and live deployment still require human QA; do not label this package "Stable" before that acceptance.

See `docs/S0_PVP_RC42_PART6_HANDOFF_2026-11-24.md` for the detailed change log and test/installation notes. Historical RC41 documentation is preserved under `docs/archive/`.

## RC42-B (Part 6 final) cross-package sync

This backend includes the latest uploaded `PVP_ONLY_RC42_All5_Import_SharedFavicon`
frontend, five adapted mobile improvements, official shared favicon/header
resources packaged locally, direct Battlefield WSS support, custom Import Deck
server confirmation and the original server-side atomic validation.

The `/card-art/` route serves the 250 pre-existing local
`public/battle/card-art/` files without duplicating those files. Site-only
resources inside this standalone are local static copies; the separate Website
package excludes them. The unique PvP sound and card-back assets are preserved.

Build ID: `gl-s0-pvp-rc42-r398-r40-20261124-b`. The Website `/pvp/` frontend must have this
exact same build ID before deployment. No remote deployment was performed.
