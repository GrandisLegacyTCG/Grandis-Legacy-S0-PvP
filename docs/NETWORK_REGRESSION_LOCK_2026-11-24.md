NOTE (S3): this initial regression-lock document predates STEP 1. Proven P0-N01/N02 fixes are implemented in STEP 1; other release gates remain open. See docs/step3/FINAL_RELEASE_QA_AND_PERFORMANCE_2026-11-24.md.

# Grandis Legacy Season 0 — PvP Network Regression Lock

**Recorded:** 24 November 2026  
**Status:** Open / not fixed. This note is an audit and regression specification; it does not certify a release.  
**Scope:** PvP only. Do not modify Season 1, the Website root, or VS AI gameplay when fixing this regression.

## Provenance and comparison

- Historical RC40 network reference: GitHub `GrandisLegacyTCG/Grandis-Legacy-S0-PvP`, commit `e07550426830062d54bf4660b8edcb145051f219` (16 November 2026), `public/battle/runtime/pvp-network.js` Git blob SHA `883e594bd277e0c93f8a004eb2e13ea14d816e63`.
- The initial RC41 commit retained that same `pvp-network.js` blob, but engine/authority files changed. Therefore, a new PvP regression must not be attributed to the WebSocket transport alone without a traced call path.
- The RC42 GitHub reference inspected was `94df8d8a9d7cf8fe70b652f43c8a940f9910da70`. The current browser/server pair and any locally supplied HF packages must be fingerprinted again before remediation.
- RC40 is a **behavioral comparison reference**, not authorization for blind file replacement or proof that every RC40 test was green.

## Open failures observed by owner

1. **Attack-follow-up opponent Mana selection**: two face-down Shards can be selected but CONFIRM raises `Runtime action was not legal or no pending choice accepted: commitOpponentManaSelection`. The expected Mana Burn/Steal resolution does not occur. Direct Mana selection and nested Attack continuations must be covered separately.
2. **Card backs**: legacy/obsolete card-back faces are visible. Use current owner-approved Back-of-Card assets and map Main, Legacy and Shard to their correct face-down resources. Preserve viewer secrecy.
3. **Mobile aspect ratio**: PvP uses independent X/Y scaling for phone Battlefield, which can stretch Hero and card art. Adopt the approved VS AI mobile presentation selectively, but preserve **uniform aspect-ratio-safe stage scaling**, orientation and overlay/touch semantics.

## Mandatory network and continuation invariants

- Preserve RC40's confirmed networking contracts where still applicable: two real seats, one server-authoritative match, WebSocket connection and reconnect, ACK + revision and replay protection, viewer-safe snapshots, and one final intent per locally drafted decision.
- Never interpret a low-level engine `false` or empty result as **action rejected** without checking its actual meaning. `false` can mean **no further pending continuation** after a successfully completed Attack-triggered Mana choice.
- Distinguish `REJECTED`, `COMMITTED (no pending)`, `CONTINUE (server-only)`, and `WAITING FOR HUMAN`; normalize at the engine/adapter boundary, not through a superficial string substitution.
- Commit/rollback atomically and only once. Do not deduct payment, deal damage, inflict Status, remove Mana, or resume a Response twice. Preserve actor/seat mapping and prevent secret-card or Shard identity leaks.
- Browser selection is local/draft only. Server validates the final choice handle, pending identity, actor, revision, and physical resource against canonical state.
- Changes to UI/mobile must **not** modify the network protocol or gameplay authority unless independently justified and regression-tested.

## Required regression gates before any new ZIP

- Direct opponent Mana Burn and Mana Steal, **Attack-follow-up** Mana Burn and Mana Steal, both Seat 1 and Seat 2; each choice completed from selecting shards through CONFIRM, ACK, authoritative Mana Pool change, render and next legal action.
- Reject duplicated, wrong-count, expired, stale-revision, out-of-range and wrong-seat choices without partial state mutation.
- Verify all other pending decision flows: response chains, exact Mana payment, card/Hand search, Import Deck, Rank Up, Legacy, Return EXP, status removal and end-of-turn effects.
- Browser-hosted 2-player acceptance: Host, Join, Ready, Spectate, combat, reconnect and reload, including one phone and one desktop where practical; do not report only headless harness tests as end-to-end PASS.
- Mobile checks: artwork/canvas aspect ratios across phone portrait (rotated), landscape and tablet; touch and swipe, card preview, dialogs, action buttons and card backs.
- Verify frontend/backend Build ID, `/health` and WebSocket Origin against the **actually deployed** Northflank service, not a local mock; record any unverified production test as NOT TESTED.
- Compare the complete release against its baseline, report modified/added/removed files and checksums, and keep independent backend and `/pvp/` Website ZIP outputs.

## Documentation precedence

This is an additional **release-specific regression lock**, not a replacement for `Grandis_Legacy_VS_AI_to_PvP_Developer_Guide.md` (particularly Section 8 on continuation semantics and gates CONV-08 / CONV-10) or `Grandis_Legacy_PvP_Developer_Guide.md`. The documented semantic issue already existed in that guide; the failure was inadequate implementation and regression coverage, not absence of architecture notes.

## Future VS AI mobile donor policy

Once the owner supplies the latest VS AI source, use it as the presentation reference for: layout, card sizes, controls, preview, payment selection, touch gestures, scroll, fonts and responsive behavior. **Do not copy AI decision handlers, VS AI's local-authority game state, or its connection setup into PvP.** Where visual components depend on gameplay state, use a PvP UI adapter from viewer-safe server snapshots, keeping the established PvP network/authority boundary. Perform a visual parity audit and a PvP-only multiplayer regression before release.
