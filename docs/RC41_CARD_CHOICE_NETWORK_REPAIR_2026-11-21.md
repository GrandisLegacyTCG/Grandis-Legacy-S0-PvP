# Grandis Legacy — Season 0 PvP RC41 — Card-Choice Network Repair

**Scope:** repair multiplayer card-selection deadlocks without changing the Season 0 game rules, card database, build identity, WebSocket message envelope, room mechanics, spectator privacy, or shared asset URLs. **Do not touch Season 1.**

## Confirmed root cause: selecting from a hidden physical Main Deck

For privacy, the server's viewer-safe `playerDeck` contains masked card backs, not the true physical card IDs. However, the old PvP browser adapter called the donor engine's `selectCardSearchChoice(index)` locally. This donor function first checks `physicalDeck[candidate.deck_index] === candidate.card_id`. That comparison necessarily fails on a masked client snapshot, so the selection was rejected *before it could be sent over the WebSocket*. The match appeared stuck at card selection even when the real server had a valid choice. Reproduced by deterministic browser tests and real authority fixtures.

This affects any similar `card_search_choice` involving physical deck positions, not only Tune Up. No private deck order can be exposed to fix it.

## Repair design

1. **Local choice draft:** the browser records only selected candidate indices, the pending token, source/zone and current revision. It projects highlights for rendering without modifying the masked canonical snapshot or guessing card contents.
2. **Single atomic commit:** on CONFIRM, the browser sends `commitExactCardSearchChoice` with selected indices and the choice identity. This also works for Hand and Discard source zones.
3. **Server-only replay:** the authority verifies ownership, valid choice count, position uniqueness, current token/source/zone and the physical card identity using the donor engine's original `selectCardSearchChoice` and `handleChoiceConfirm`. On failure the canonical state/revision remain unchanged.
4. **Additional local choices:** Legacy Ability cost, status cleanse selection and blind opponent-Hand selection use `commitExactLocalChoiceDraft` with strict server replay. Existing normal Mana Draft, blind Mana selector, Response batching and legacy choices remain supported.
5. **Responsive feedback:** a second gameplay action while awaiting ACK is no longer silently dropped; players see a brief processing notice. Stale-revision actions are NOT queued.
6. **Animation cannot block game progress:** relevant confirmation handlers dispatch the network intent *before* playing optional card-motion animations. Animation failure no longer prevents an authorized commit.
7. **Asset cache:** a new `choicefix=20261121-a` per-file URL query marks the changed browser scripts without changing the multiplayer `buildId`. Backend Brotli/Gzip sidecars are regenerated so the HTTP server cannot serve obsolete compressed JavaScript.

## Donor verification

Compared `Grandis_Legacy_VS_AI_Season0_RC41_2026-11-20.zip` against the **Part7 Hotfix standalone donor** of the same date. The donor's newer changes correct Response Item eligibility (including Spectral Grappling Hook, Chain Mail and Ring of Protection) and apostrophe parsing. Those are **gameplay/rules changes**, not an additional multiplayer synchronization implementation. They are deliberately NOT silently merged into this network-only hotfix; the card engine and print data remain unchanged. Gameplay donor parity needs a separately approved synchronization when the owner asks for those rule changes.

## Verification

- `npm run check:rc41`: PASS, including syntax, donor/source integrity, engine regression **20/20**, two-seat WebSockets and new choice tests.
- `node scripts/run-rc41-release-check.mjs`: PASS **50/50** retained compatibility/network tests (source-hash expectations updated only where the reviewed network/headless code changed).
- `npm run test:choice-network`: PASS browser-adapter reproduction, exact-card replay, invalid token/duplicate/index cases, real engine **Seat 1 and Seat 2**, invalid canonical-state rollback.
- `npm run test:http`: PASS Brotli/gzip HTTP serving and cache behavior.
- Website overlay references were checked against the supplied November 20 full Website source: **0 missing HTML/CSS references**, **248 root card artworks** present, **no duplicated card artworks** inside `/pvp/`.
- Website WebSocket config remains `wss://p01--grandis-legacy-s0-pvp--2kwws8nzlcc2.code.run/ws`; the backend buildId remains `gl-s0-pvp-rc41-r39-v34-part5-2026-11-19`.

## Non-claims and deployment

These tests prove the reproduced failure is fixed for the tested workflows and seats, **not** that every possible full custom-deck match is deadlock-free. A full multiplayer production match on Northflank with both physical browsers still needs verification. If further freezes occur, capture both browser consoles with `?pvpPerf=1`, the pending type / revision and server errors, preferably the card/choice that triggered it.

Install **either** the patch ZIP over the exact latest Mobile Parity backend release, **or** the complete backend ZIP; never both. Merge the corresponding website ZIP's `pvp/` folder into the new `Grandis-Legacy-S0-Website` root; do not overwrite shared root assets or other site apps. Upload/deployment is the owner's responsibility. Keep Room2 as fallback; do not touch Season 1.
