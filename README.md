> **Latest standalone VS AI UI sync (25 Nov 2026):** Presentation-only adaptation of universal Action Popup sizing (desktop 100% Hero, mobile 89%), mobile Hand auto-fit, Hero HP/Status scaling, tap-to-read Status, portrait scroll, review layout and Card Played 6/9 responsive slots. All PvP server authority, WebSocket/ACK/reconnect, gameplay engine and exact-card thumbnail pipeline are byte-identical to the validated S3 UI Sync 1 base. Standalone binary dedup remains active (102 aliases, hydrated by `npm start` / Dockerfile). Run `npm run test:vsai-ui` for synthetic UI source/browser gates. See `docs/VS_AI_STANDALONE_UI_SYNC2_2026-11-25.md`; not a claim of real Android or Northflank validation.

> **Standalone binary dedup (25 Nov 2026):** ZIP source omits 102 byte-identical duplicated binary assets, with an SHA-256 manifest. `npm start` and the Dockerfile restore all old public URLs with local hardlinks (copy fallback) **before serving**; do not run raw `node server.js` directly on an unprepared extraction. Run `npm run prepare:assets` and `npm run verify:assets` when inspecting the extracted source. PvP networking, game engine and Website `/pvp/` are unchanged. See `docs/ASSET_DEDUP_AND_SOURCE_WORKFLOW_2026-11-25.md`.

> **UI thumbnail sync 2026-11-25:** 250 latest VS AI self-contained miniatures guarantee first painted face-up art; responsive PASS/REPOSITION, Import Deck dark-gold style, mobile counters; no network/engine changes. See `docs/UI_SYNC_2026-11-25.md`.

# Grandis Legacy PvP S0 — RC42 STEP 3 final paired QA candidate

**Build:** `gl-s0-pvp-rc42-r398-r40-20261124-s3` — **LOCAL QA CANDIDATE, NOT PRODUCTION STABLE**.

- Rules/game engine: approved VS AI RC42 donor + Season 0 cards R3.98/R4.0; PvP-specific authority integration remains separate.
- Network: independent PvP RC40-derived WebSocket/authority/ACK/reconnect; S1 stability fixes retained. VS AI networking is not imported.
- UI: VS AI RC42 mobile Batch 2 parity adapted for PvP; uniform stage scale; approved Main/Legacy/Mana backs.
- STEP 3: lazy exact-card thumbnails, adaptive full-image decode budget, disable second hidden game VM on mobile/constrained devices, READY-only desktop warming, smaller bootstrap prefetch on constrained devices.

**Run:** `npm ci --omit=dev --ignore-scripts --no-audit --no-fund`, `npm start`, `npm run check`. Standalone serves `/`, `/pvp/`, `/battle/`, `/pvp/battle/`, `/ws` and `/health`. Native production mode requires `ws@8.21.0` with `PVP_REQUIRE_WS=1` and Node 22; provided Dockerfile handles this. One replica / one active in-memory room. Site package merges ONLY `pvp/` to Website root and expects existing `/card-art/` and shared assets.

**Full audit, known gaps, precise local evidence and production deployment:** `docs/step3/FINAL_RELEASE_QA_AND_PERFORMANCE_2026-11-24.md`. This supersedes older STEP 1 release-facing README text, but the historical documentation remains intact under `docs/`.

**No GitHub commit or Northflank deployment performed.**
