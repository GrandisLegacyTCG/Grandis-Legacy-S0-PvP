# Grandis Legacy PvP — VS AI RC40 Presentation Parity Audit

**Date:** 2026-11-16. **Scope:** only full standalone PvP and Website `pvp/` folder. **GitHub:** READ ONLY; owner manually uploads. **Release identity:** `gl-s0-pvp-rc40-patch32-vsai-parity-2026-11-16`.

## Provenance and baseline

- **Approved VS AI donor inspected:** `Grandis_Legacy_VS_AI_Season0_RC40_2026-11-16.zip`, SHA-256 `8f01f35bedffb0bdad2bcc81cfe3a589889993c3a2df6217216dfc9afaa51577`. The donor was provided as an archive; do not assume the GitHub Website root is automatically the same commit.
- **Standalone PvP baseline archive:** `Grandis_Legacy_PvP_Trial_RC40P32_ItemArrow_Paladin_NavOrder_FULL_REPO_READY_UPLOAD_2026-11-15.zip`, SHA-256 `cc772366152ccdeeaf8ec67f080611baa37fec41f9ad11bc7cce6ead8b2639d9`. Corresponding repo checkpoint: `GrandisLegacyTCG/Grandis-Legacy-PvP-Trial` main `173816c39ac1f2f21192525e93bad11c60fda043` (Update5).
- **Website PvP baseline archive:** `Grandis_Legacy_Website_PVP_FOLDER_ItemArrow_Paladin_NavOrder_READY_UPLOAD_2026-11-15.zip`, SHA-256 `5bb6f63fa7fbcf488fd717fb9e6dd4ab348b8a1440a5aa0e3b776b26deb36099`. Corresponding Website checkpoint: `GrandisLegacyTCG/Grandis-Legacy-Website` main `ab561b48a1cf6d2a8511b1e04628863bf23f06e9` (Update2).
- Initial donor-vs-standalone audit: 415 common files, 406 byte-identical, 9 different due to PvP-specific engine/renderer, URL layout, application mode and presentation rules. Differences were inspected rather than blindly overwritten. The newer donor has some non-PvP files (e.g., AI-only logic, local VS AI music), intentionally not mirrored to PvP.

## Findings and changes

| Area | Audit finding | Corrective integration | Validation |
|---|---|---|---|
| Chosen Main Deck / Discard pickup | VS AI RC40 emitted `CARD_PUBLIC_PICKUP`, but PvP engine lacked this post-commit notification. | Ported the donor's exact event contract into six committed acquisition routes; per-seat viewer-safe output includes only the public selected card ID and source zone. Both players receive viewer-relative events, and only the opposing player sees the artwork notice. | PASS: real engine manual and opponent-side Main Deck/Discard tests, both-seat safe projections and notice grouping. |
| Ordinary Draw / hidden Hand | Unconditional reveal would disclose private card IDs or physical Hand positions. | Ordinary `CARD_DRAWN` remains hidden from opponent; only deliberate publicly selected pickups are revealed, with physical Hand slot removed from public event. | PASS: secret Draw ID, hidden zones, invalid card IDs and unknown zone rejection tests. |
| Status outcome detail | PvP's sanitized Card Played status result omitted the donor's base duration, bonus, applied duration, bonus name and limit. UI could show `undefined` or incomplete status. | Added explicitly whitelisted public status duration metadata in `viewer-safe.mjs`, then mapped the fields into the existing donor Card Played renderer without exposing hidden engine state. All core status mechanics unchanged. | PASS: output fields, invalid status rejection, renderer adaptation; pre-existing combat/status tests PASS. |
| Card Preview first-open latency | Deck Builder review iframe requested 19 cascading CSS files and warmed assets only after a long idle timeout. | Merged all 19 CSS files **in the same order** into one combined stylesheet, retained all originals, changed both battle/lobby adapters on both surfaces to use the bundle, shortened warmup to 300ms fallback / 1200ms idle timeout. | PASS: exact CSS concatenation check and four path checks. **Measured browser latency not verified** (sandbox browser access blocked). |
| Review Mana terms | Two approved donor display-only source files differ in terminology. | Synced donor's reviewed wording JS and generated Hero-components display JSON in both PvP surfaces. Game engine and Mana value rules unchanged. | File/source parity checked; gameplay parity covered by existing Mana suite. |
| Existing Item Arrow and Paladin/Crusader | Previous hotfix is already present. | Preserved both. No new changes to server target action validation or existing Mana-loss ownership rules. | Item Arrow/Paladin regression PASS, RC39 Mana-loss privacy PASS. |
| Backend/build integration | Website static client and server use distinct frontend paths and share a strict build ID. | New identical build ID in `server.js`, Website `pvp/build-meta.js`, and both HTML cache keys; Website WSS config and root VS AI/Deck Builder untouched. | Source identity and parse checks PASS. Live WSS NOT VERIFIED. |

## Architecture/security guardrails

- PvP is human vs human; the donor `AI` enum is a viewer-relative seat label, not an AI player. Client may show only public target/selection metadata.
- Server remains authoritative for all gameplay actions, legal sources, payment, response, status, defeat, Choice and Turn Order. No copied donor AI turn scheduling or UI state mutations.
- Viewer-safe projection, real VM test, canonical gameplay tests and per-seat tests were preferred to bulk replacement of the different PvP game bundle.
- The Website folder references the existing root Website's `/card-art/` assets and external `assets/js/s0-artwork-fallback.js`. These are intentionally not duplicated under `/pvp/`. The approved root Website must retain them.
- `npm run build:precompress` regenerates the standalone compressed `.br/.gz` static assets to avoid stale runtime delivery after source changes.

## Executed QA and limitations

- **PASS:** `npm run check:rc40-p32`, including the 19/19 added parity checks, source/engine tests, Viewer Safe and item/discard 353/353.
- **PASS:** Item Arrow (both seat perspectives) and Paladin/Crusader regression, RC39 Mana loss, RC38 combat/Status regression, selected/deck assets integrity.
- **PASS:** historical `npm run check` through RC39 RC3 after updating its outdated PvP lobby SHA-256 pin to the previously approved nav-order baseline. The full historical command exceeded an execution-time limit during RC39 RC4; running that single test separately **PASS**. Other historically later test groups were run separately and **PASS**, as recorded in local logs. **Full uninterrupted `npm run check` is NOT VERIFIED**.
- **NOT VERIFIED:** real browser first-open Card Preview timing comparison with VS AI, two physically independent browser sessions communicating with Northflank, production `ws` Docker deployment, GitHub Actions after re-upload, and an entire deployed natural PvP match. Browser localhost navigation was rejected by the sandbox (`ERR_BLOCKED_BY_ADMINISTRATOR`). No server/backend deployment was made here.

## Release and upload boundaries

1. Standalone **full repository ZIP**: entire `Grandis-Legacy-PvP-Trial` repository root, including `server.js`, `server/`, `public/`, `tests/`, `docs/`, `Dockerfile`, package manifests and regenerated sidecars.
2. Website **complete `pvp/` folder ZIP**: only the `pvp/` directory containing static frontend and Website-specific subpath/WSS configuration. Does **not** overwrite root VS AI or Deck Builder and does not contain Node backend.

**Use both ZIPs as one coordinated update because the client/server build identity changes together.** Update PvP service/backend first and the Website folder immediately after; mismatched clients should be refreshed. All GitHub commits/uploads remain the owner's manual action.
