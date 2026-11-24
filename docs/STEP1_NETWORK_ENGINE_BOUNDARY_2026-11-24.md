# Grandis Legacy Season 0 PvP — STEP 1 Network / Engine Boundary

**Date:** 24 November 2026  
**Build:** `gl-s0-pvp-rc42-r398-r40-20261124-s1`  
**Status:** **STEP 1 local QA candidate** — not a production Stable release. No GitHub changes or deployment performed.

## Source of truth and ownership

- **Gameplay donor:** supplied VS AI RC42 (current uploaded snapshot), verified by comparing its game bundle and `static-data.js` to the PvP baseline. The PvP bundle is not byte-for-byte identical: it deliberately includes multiplayer-facing display/authority adapters and corrected resource URLs. **No donor gameplay bundle was replaced or modified during this STEP 1.** The existing RC42 gameplay integration remains the authority. Content: Main Deck R3.98, Legacy R4.0; rulebook v3.5.
- **Multiplayer transport:** PvP RC40 behavioral reference, GitHub commit `e07550426830062d54bf4660b8edcb145051f219`; `pvp-network.js` was carried forward unchanged from HF2. RC40 is a behavioral reference, not an authorization to overwrite newer files.
- **PvP server:** canonical one-match authority, seat ownership, revisions, viewer-safe masking, websocket ACK, local pending draft confirmation. All changes are restricted to backend adapter and network trust boundary.

## Implemented fixes

**S1-N01 — Attack-follow-up Mana Burn / Mana Steal (`server/headless-rc32.mjs`, `server/commit-semantics.mjs`)**  
The donor can complete the physical Mana removal and post-Attack continuation, then report `false` because no more choice is available. The previous adapter treated it as an illegal action and rolled back the entire transaction, producing the exact owner's screenshot error. The new adapter accepts **only** that terminal condition when the expected pending continuation existed, the correct physical Mana UIDs were removed, and the pending choice has disappeared. A different `false` remains an error and does not commit. This is a PvP integration fix, **not a change to VS AI card rules**.

**S1-N02 — Missing action IDs / ACK (`server.js`)**  
Server previously committed gameplay messages with no `clientActionId`, incrementing the revision without an actor ACK. Such packets now return `MISSING_ACTION_ID` **without state mutation**. Valid action IDs are replay-idempotent; a reused ID with a changed payload returns `ACTION_ID_CONFLICT`; stale revisions do not mutate.

**S1-N03 — Stale socket after seat reconnect (`server.js`)**  
WS message handler ignores messages from any socket that no longer matches its seat's current `client.ws`. The verified replacement session retains its seat, while the old session cannot mutate the match.

**S1-N04 — Post-Provoke End flag (`server/headless-rc32.mjs`)**  
Headless PvP now clears stale `autoEndTurnPending` and `autoEndResumeScheduled` after the engine has already left End and no Response/pending choice remains. This does not advance past a player's outstanding choice; real End/Provoke scenarios are regression-checked for both seats.

**S1-N05 — Lost ACK on surrender after match ends (`server.js`)**  
The exact same previously committed action ID/payload can be replayed after `finished`, returning the original applied revision without a second surrender. Newly submitted actions still fail outside `started`.

**S1-N06 — Regression gate / build isolation**  
New `test:step1` and a mandatory `npm run check` gate. Added tests for the newly fixed pathways and corrected the archived `ws-gate.py` RC41-only health expectation to the current RC42 contract. Build ID is distinct from HF2 and identical in the standalone/backend and Website-only frontend; cache-busting query strings were updated accordingly. Compressed JS/HTML sidecars were regenerated.

## Tests executed and actual results

| Test group | Result | What is tested |
|---|---|---|
| `npm run check` (RC42 tests + Step1 tests) | **PASS** | Local gate, browser-source contracts, server local game flows and protocol. Run in Node 22. |
| `tests/step1-mana-continuation.mjs` | **PASS** | Four real headless donor scenarios: post-Attack Burn and Steal, each from Seat 1/Seat 2; exact removal, pending close and revision. Includes false-positive rejection of helper. |
| `tests/step1-websocket-authority.mjs` | **PASS** | Two real WS clients + spectator, Host/Join/Ready/start, absent/duplicate/stale action IDs, sender ACK, spectator/private Hand masking, reconnect/old socket and after-finish surrender replay. |
| `test:deadlock-engine` | **PASS** | Draw / End / Provoke continuation, both orientations. Previously stale End flag. |
| `test:ws-gate`, `test:deadlock-ws`, `test:net-rc6-live`, `test:ack-race` | **PASS** | Local pregame, WebSocket origin, seat reconnect, delayed ACK, coin and idle transitions. |
| `test:postmatch` separately | **PASS** | Post-match cleanup/lobby reset. |
| RC42 Import Deck regression in `check:rc42` | **PASS** | Five official Deck Builder exports with server confirmation; not physical browser interaction. |

**Transport caveat:** These tests ran with the **offline `ws-lite` fallback** (`transport:lite`). The pinned `ws@8.21.0` dependency is present in `package.json`/lockfile and required by Docker with `PVP_REQUIRE_WS=1`, but a native `ws` installation and Docker/Northflank run were **not tested here** because dependency installation did not complete in this environment. Do **not** claim a Northflank PASS from local tests.

**Known remaining test failures (not silently discarded):** the archival `test:rc41-f19-network` contains old F19 synthetic Swap/Soul Blast assumptions conflicting with newer approved card wording and includes two bad fixtures. Its failure has **not** been reclassified PASS; end-to-end card-specific F19 coverage needs current donor fixtures. Archival `test:rc39-batch5` expects 248 cards instead of current 250; `test:rc40-p32` expects old card content. Rebase these tests to current authority instead of changing current rules to satisfy historical snapshots. They are **not part of the mandatory green Step1 gate**.

## Explicitly *not* changed in STEP 1

- **No game card/rule changes:** `public/battle/engine/shared-app/app.bundle.js`, `static-data.js` and all gameplay overlays are byte-identical to HF2; no network code was imported from VS AI.
- **No PvP browser network rewrite:** `public/battle/runtime/pvp-network.js` and host selection transport remain byte-identical to HF2.
- **No mobile UI or asset fix yet:** the owner's reported stretched/mobile aspect ratio and obsolete Back-of-Card image are still **open**. This build should not be used as an accepted player-facing release until the later UI step and regression gates succeed.
- **No low-RAM optimization yet.** That belongs to Step 3 and must have before/after measurements. No evidence of a fixed memory leak is claimed.
- **No real production Northflank test**, Android/desktop cross-device match, 100-intent endurance match, or 20+ match soak. Those acceptance gates remain open.

## Deployment contract (for subsequent approved manual release)

1. Standalone package is Docker backend; Website package contains **only `pvp/`**. Never deploy Standalone ZIP into GitHub Pages.
2. Update **both** packages as a pair and confirm the same Build ID `gl-s0-pvp-rc42-r398-r40-20261124-s1` with `/health`. Old `-b` frontend cannot connect to new `-s1` backend (and vice versa) by design.
3. Production backend must return `transport:"ws"`, use one replica for the current in-memory room, and accept Website Origin; `/pvp/config.js` WSS hostname must point to the actually active Northflank service. This hostname is **not independently verified** in this Step.
4. On the live service, run `GL_PVP_BACKEND_URL=https://<actual-host> npm run smoke:northflank`, then manually validate two browser seats, one spectator, Import Deck, Attack continuation, reconnect, and mobile visuals. Do not deploy or claim Stable before that.

## Boundary rule for all future work

**VS AI supplies rules + approved presentation only. PvP supplies network, authority, player privacy, and session semantics.** Adapt the donor at the bridge; never globally replace PvP network or normalize every engine `false` to success. Each new donor update must pass both-seats validation for direct and post-Response/post-Attack continuations.
