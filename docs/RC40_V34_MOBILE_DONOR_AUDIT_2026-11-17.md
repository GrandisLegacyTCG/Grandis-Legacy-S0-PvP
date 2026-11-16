# Grandis Legacy Season 0 — PvP / VS AI RC40 / Rulebook v3.4 / Mobile Parity Audit

**Date:** 17 November 2026. **Scope:** `Grandis-Legacy-PvP-Trial` standalone and the static `Grandis-Legacy-Website/pvp/` frontend. The Website's VS AI and Deck Builder outside `/pvp/` are out of scope.

## Source checkpoints

- Approved new donor inspected: `Grandis_Legacy_VS_AI_Season0_RC40_2026-11-17.zip` (its own `engine/shared-app/app.bundle.js`, `shared-app/app-runtime.js`, `shared-ui/battlefield-ui.css`).
- Rulebook: `Grandis_Legacy_Player_Rulebook_v3.4_EN_2026-11-17.pdf` (17 November 2026; 15 pages).
- Latest previous PvP release baseline: 16 November full standalone 751-file archive and Website 218-file `/pvp/` archive (equivalent to GitHub PvP `247ec757` and Website `e1c17bd9` at audit start).
- Older donor used as common ancestor for three-way engine port: VS AI RC39 Part 5 Batch 2. The new donor game bundle was **merged**, not blindly copied; preexisting PvP authority hooks, public pickup events, Mana receipts, replay prevention, viewer-safe fields and network semantics were retained.

## Rulebook v3.4: implemented / checked

| Rule | Action in PvP | Verification |
|---|---|---|
| Main Deck exactly 50; 3 Hero progression packages; max 1 Special Event | Existing Season 0 validator retained | All 5 starter decks + deck validation QA |
| Ultimate: max 1 per bound Hero, max 3 total | Added **server-loaded engine validation** of owner and total physical Ultimate counts; duplicate names remain banned | 3 distinct owners PASS; 4 Ultimates rejected; duplicate owner rejected |
| Stun bars Skills, Events, Class Abilities, Racial Traits; **Items remain playable** unless other card conditions prohibit | Card source validator now allows otherwise legal Item use by Stunned / Exhausted Hero by default; preexisting Protection Item response ruling retained | Real engine source-eligibility and RC34 protection Item QA PASS |
| Poison duration/damage; Freeze, Sleep, Burn, healing, negation and mandatory Draw rules | Existing engine and approved card/rule paths retained; imported current donor engine changes where compatible with PvP | Full historical suite and v3.4 focused test; rule-by-rule human match not run |
| Mana Deck: 12, max 1 of each Color, and any Color allowed in printed rulebook | **Known existing app policy discrepancy:** donor VS AI/PvP currently derives Color Mana from selected Hero lineages and overwrites imported Mana. This was already true before this release; not silently changed in a PvP-only integration. | Existing donor/engine QA explicitly asserts auto-derived Mana; owner reconciliation still needed for the printed-rule difference. |

Important: Rulebook v3.4 itself does not automatically change the OSA or printed cards. This audit does not claim that all preexisting OSA/app policy discrepancies have been resolved.

## New VS AI RC40 game engine changes

- Imported relevant gameplay corrections through a three-way merge from the 17-Nov donor; preserved PvP-only hooks and patched `GL_VERSION` Rulebook revision metadata.
- Kept the **preexisting PvP AI fallback code** when the donor's new AI-only path introduced a missing `chooseBeginnerAIAction` in the hybrid bundle. This restores regression parity in the headless/local harness; PvP game state still remains human-vs-human server-authoritative.
- Standalone PvP and Website `/pvp/` ship the same merged gameplay logic; Website-only eight Mana artwork URL prefixes remain adjusted to the Website mount.
- The approved donor `static-data.js`, generated card definitions and active starter data were previously byte-compatible with the PvP baseline; unnecessary wholesale replacement was avoided.

## Mobile M01 / M02 / M03

- **M01 (mobile deck menu):** adapted VS AI's handset hamburger to the **existing PvP single-deck lobby**. It offers `Choose Deck` and `Import Deck`, reusing original select/input handlers. Desktop dropdown and Import Deck remain unchanged; `pvp/` parent keeps the 1180×590 handset stage.
- **M02 (mobile modals and notices):** adapted VS AI's 1600×747 gameplay-layout limits for choice, EXP Inspector, Card Review, Card Played, hover preview, turn, Counter and Chain notice. PvP already rotates the **entire body**; new rules intentionally do **not** apply a second `--gl-stage-transform` to modal portals.
- **M03 (Discard twice to inspect):** ported VS AI 1.1-second same-pile double-tap gate, arm outline, outside tap cancel and desktop immediate-click behavior into both PvP runtime copies. Does not send any game intent or reveal hidden information.
- The existing PvP responsive lobby and Coin Flip remain separate; the VS AI-specific AI difficulty/lobby layout and Local AI controller are **not** copied into PvP.

## Previously approved fixes retained

- Publicly selected Main Deck and Discard pickups with opponent notification; ordinary Draw stays private.
- Per-seat Item arrow target geometry and viewer-relative status duration.
- Paladin / Crusader own-Mana notices; opponent-facing blind Mana privacy.
- Card Review CSS preload/bundle and existing player-specific history/presentation.
- One parent-owned WebSocket, masked seat projections, server-only game state, atomic pending choices, per-revision intent validation and spectator read-only privacy.

## QA results / limitations

- `npm run test:v34-mobile`: **10/10 PASS**, including real engine Rulebook checks, both static PvP runtimes' handset double-tap, mobile UI guards and current build ID.
- `npm run test:rc34-rules`: **20/20 PASS** after preserving the PvP AI fallback required by this historical regression harness.
- `npm run check:rc40-p32`: **PASS** (includes the 19/19 prior VS AI parity tests, privacy, artwork, networking and targeted RC40 suites).
- `npm run check`: **PASS** full historical suite after re-pinning one deliberately changed lobby-host SHA for approved M01 changes. Other transport/headless SHA guards remain intact.
- `npm run build:precompress`: **PASS**, regenerated standalone Brotli and Gzip static assets (85 assets).
- **Live browser/mobile visual parity NOT VERIFIED**: Chromium on local `127.0.0.1` returns `net::ERR_BLOCKED_BY_ADMINISTRATOR` in this environment. Touchscreen rendering and Northflank production WSS multiplayer should still be acceptance-tested on devices after user deployment.
- The public GitHub repositories were read **only**. No source push or deployment was performed.

## Deployment

Two coordinated artifacts must use the same build ID: `gl-s0-pvp-rc40-v34-mobile-parity-2026-11-17`.

1. Full standalone ZIP: replace the contents of `Grandis-Legacy-PvP-Trial`; deploy its Node server so its dynamic `/build-meta.js` matches.
2. Full `pvp/` folder ZIP: replace **only** `Grandis-Legacy-Website/pvp/`; preserve the Website root VS AI, Deck Builder and the shared root artwork-fallback asset.
3. Smoke test lobby and mobile `Choose Deck` / `Import Deck`, both seats, Coin Flip, opening, Card Review, Discard double-tap, two-sided targets, Response, and spectator hidden zones. Both surfaces must converge on the exact same build ID.
