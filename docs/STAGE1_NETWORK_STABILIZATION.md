# Grandis Legacy PvP — Stage 1: Network and Authoritative Choice Stabilization

**Deliverables:** (1) complete standalone PvP backend repository, (2) website-root **`pvp/` only**.  
**Status:** Staging / integration candidate. **Not production certified; Stage 2 frontend fixes and Stage 3 live certification remain pending.**  
**Source baseline:** Season 0 PvP standalone backend RC41 F19.  
**Donor policy:** No donor VS AI upgrade, card-catalog update, client artwork replacement, Card Review redesign, or lobby button styling in Stage 1.

## 1. Incident: previously fixed Mana commit rejected again

The donor engine uses a `false` result from `resolvePostAttackChoices` to signal that an Attack's final optional/mandatory continuation has **no remaining pending choice**. The PvP transaction wrapper used a boolean success/failure contract and treated this **completed** result as a rejected `commitOpponentManaSelection`. That raised a runtime error and rolled back an otherwise legitimate Mana Burn/Steal selection. Historical RC39–RC40 code had normalized this distinction, but an RC41 donor replacement reintroduced the old return value.

**Stage 1 fix:** `server/headless-rc32.mjs` defines `normalizePvpEngineOutcome`. It is called only from the approved headless PvP intent/transaction adapter. It does **not** edit the donor gameplay bundle. It recognizes exactly one exceptional outcome (`commitOpponentManaSelection` in a pre-existing Attack continuation), and normalizes `false` to success **only after authoritative post-state proof**:

- Exact selected count, valid candidate indices, unique physical Mana shard UIDs;
- The targeted opponent's Mana Pool lost exactly the selected physical shards;
- The targeted opponent's Mana Deck received exactly that count, with selected UIDs present;
- The pending choice advanced or resolved (did not remain the same unresolved choice);
- The failure is the exact expected runtime-return-convention error, not a genuine rules rejection.

All other negative results throw and trigger the existing authoritative rollback. Server ownership of deck, card identities, hidden state, token scope, revision, idempotency and action legality is unchanged. The normalizer neither chooses shards nor invents gameplay legality.

**Rollback behavior:** A forged choice, stale revision, duplicate handle, altered server inventory, incorrect pending context or unrelated failed intent must remain rejected without revision increment or client-visible partial game state.

## 2. Authority and integration boundaries

- **Gameplay donor:** rules, effects, damage/status, Mana burn/steal semantics and true game-state transitions. Protected source `public/battle/engine/shared-app/app.bundle.js` remains unchanged in this stage.
- **PvP engine adapter:** maps two human seats into the donor's active player/AI-side state and normalizes only documented return-contract incompatibilities.
- **PvP backend:** authoritative choice ownership, two-player WebSocket transport, expected revision + client intent nonce, blind opaque Mana handles, reconnect, filtered `viewer-safe` snapshots, idempotent commit.
- **Website `/pvp/`:** displays each viewer-safe projection, sends player intent, reuses the existing single lobby-owned WebSocket; never decides gameplay results or reads opponent's hidden shard UID/card identity.
- **Production server:** uses native `ws`, requiring `PVP_REQUIRE_WS=1` and website origin allowlisting. In-memory room/match state assumes one running replica until a persistent coordination layer is designed.

## 3. New regression protection

Added:

- `tests/stage1-outcome-boundary.mjs` — seven rejection/proof/acceptance boundary checks. The adapter must **fail closed** without authoritative proof.
- `tests/stage1-mana-continuation-regression.mjs` — both player seats; final Attack → REMOVE_ONLY (Mana Burn), final Attack → REMOVE_AND_GAIN_OWN (Mana Steal), two chained pending Mana decisions, blind opaque handles, forged selection, duplicate/replayed commit, physical shard return, revision count and viewer privacy.
- `npm run test:stage1-network` — runs the new focused regression tests.
- `npm run check:stage1` and `npm run check` — run the preserved RC41 focused suite, the new tests and the complete 50-test historical network/gameplay regression release gate.

Stage 1 does not replace historical behavior assertions with superficial string checks. The old network and seat-specific tests are retained; only the expected server build identity and the updated adapter's integrity pin change to match the known source patch.

**Local results on the stage build (2026-11-22):**

| Gate | Result |
|---|---|
| Full historical PvP release checks | **50/50 PASS** (`scripts/run-rc41-release-check.mjs`) |
| New authoritative Mana continuation tests | **6/6 PASS** (two seats, Burn/Steal, chained) |
| New outcome boundary tests | **7/7 PASS** |
| Existing RC41 targeted/parity tests | **PASS** (`npm run check:rc41`) |
| Browser-rendered dual-client production match | **Not run**; Stage 3 gate |
| Native `ws`, Docker build and live WSS | **Not verified here**; CI/deployment gate |

The local checks can run with the repository's offline WebSocket fallback. `python3 tests/net-rc6-live-ws.py` independently **PASS** (two connected player seats, origin allowlist, RTT/ACK and same-origin protection) with transport reported as `lite`. This is **not** proof that production native WebSocket upgrades, reverse proxy, browser rendering, reconnect in a live deployment, or a complete match are stable.

## 4. Two separately deployable artifacts

### Standalone backend repository

- Complete Node.js server, server headless adapter, authoritative game engine, all local assets including `public/battle/card-art/`, tests, Dockerfile and CI workflow.
- Starts with `npm start` after `npm ci --omit=dev` on an online build host.
- Health: `/health`. Network endpoint: `/ws`. Deployment build identity: `gl-s0-pvp-stage1-network-lock-20261122-a`.
- Source of truth for backend snapshots and build compatibility; **never push code to GitHub automatically**.

### Existing website root: `/pvp/` subtree only

- `scripts/build-website-root-only.py` derives the deployable `pvp/` folder from the backend frontend with website-specific URLs, site brand shell, existing header styling and static WSS config.
- **Only upload the folder `pvp/` inside the website repository root.** Do not replace the homepage or any other website root folder.
- The website version omits duplicated `pvp/battle/card-art` and uses the *already available* external root `/card-art/`; it also requires existing `/assets/` and `/engine/assets/`. It must not be used on a blank site.
- No stale backend `.br`/`.gz` compressed sidecars are copied after website URL rewriting.
- Static `pvp/build-meta.js` must match the deployed backend **exactly**; the browser rejects mismatched builds deliberately. A backend rollout with an old website cannot be treated as compatible.
- `pvp/config.js` uses the website's already approved Northflank WSS host. Validate it still maps to the manually deployed backend before serving live traffic.

## 5. Deployment/release sequence (manual)

1. Run GitHub CI on the **backend standalone repository** with native `ws`, all checks and Docker health assertions. Stop on any failure.
2. Deploy the backend to a staging environment with the approved website origin in `PVP_ALLOWED_ORIGINS` and `PVP_REQUIRE_WS=1`.
3. Confirm `/health` returns the expected `version`, `buildId` and native `transport: "ws"`.
4. Update **only website `/pvp/`** from the site archive; ensure its `config.js` points at that backend and shared root artwork/assets exist.
5. Test from two real browser sessions on separate user seats: ready/start, Hand privacy, Mana Burn and Steal after Attack from **both seats**, Response/counter/pending continuation, ACK/revision, reconnect, match end.
6. Roll back both site `/pvp/` and backend together if build identity, gameplay or hidden-data checks fail; do not retain a half-matched pair.

## 6. Planned next stages (not implemented here)

- **Stage 2:** Approved donor parity updates; hybrid exact-card thumbnail → high-resolution rendering; Card Review popup lifecycle; targeted Search/Swap presentation; **exactly two requested PvP Lobby UI changes:** header navigation buttons and Rank selector buttons. These must not overwrite Stage 1 backend/network contracts.
- **Stage 3:** Chromium/two-browser end-to-end complete-match, latency, reconnect, hidden information, mobile, visual and gameplay release certification. Do not label stable without passing it.

## 7. Provenance and code-change constraints

This change is intentionally **in the PvP server adapter**, not the shared VS AI donor. The authoritative engine and card data were not upgraded. The donor gameplay bundle SHA-256 in the source archive and Stage 1 backend is identical: `f7c36579450b267bfb400ca4d759278518fdea1f9fe131a010c2b7113f8bfd30`. Any future donor integration must run the full historical regression gate and the new Stage 1 tests **before** a release candidate may replace the known-good backend. No GitHub, Northflank, or website deployment is performed by generating these archives.
