# Stage 3 Final Source and Regression Audit

## Scope

- The PvP backend remains server-authoritative for two human players.
- Integrate approved VS AI gameplay rules and presentation through a reviewed,
  reversible adapter, not a wholesale overwrite of working network code.
- Preserve verified historical PvP behavior from earlier release candidates.
- Update all five official Starter Deck compositions from the owner's current
  source exports; validate three progression packages, 50 Main, 12 Mana,
  12 Legacy, and both seat initial game setup for each deck.
- Include 250 in-PvP WebP card images and embedded matching thumbnails,
  including newly recognized Cheers! and Fire Flask.
- Deliver only backend repository and existing website root `pvp/` subtree.

## Tests run against the final source

| QA group | Local result |
| --- | --- |
| Historical automated gameplay / networking | 50 / 50 PASS |
| Stage 1 Mana continuation and exact transaction results | 6 / 6 + 7 / 7 PASS |
| Stage 2 artwork and retry/decode | 14 / 14 PASS |
| Stage 2 UI regression protections | 8 / 8 PASS |
| Stage 2 Casting/position-lock | 5 / 5 PASS |
| Old Hand rendering DOM contract | 54 / 54 PASS |
| F15 Card Played / Response / Search / UI | 43 / 43 PASS |
| F19 optional Swap and search / commitment | PASS both seats |
| Source official five-Starter Deck consistency and artwork | 8 strict checks PASS |
| Gameplay donor source provenance | 6 unchanged sources + reversible bridge PASS |
| Website-only subtree build, asset and route audit | PASS |
| Real Chromium decodable first-paint thumbnail | PASS |

The source-specific checks were executed in isolated jobs because some older
subprocess tests may block when launched beneath long-lived aggregating shells.
`npm run check:stage3` is the comprehensive source check; the CI workflow
separately requires historical, focused, Stage 1, Stage 2, Stage 3 and Docker
transport tests.

## Production acceptance still required

The offline container could not retrieve native npm `ws` from the internet.
WebSocket functional tests passed using the repository's RFC6455 fallback and
Python two-client transport tests. They do not constitute native `ws` or
live public WSS verification. Browser artwork was verified, but no complete
two-player Chromium match was executed. CI Docker/native `ws` and a manual
production two-browser match remain release acceptance conditions.

## Donor regression prevention

`server/compat/*.inc` contains carefully reviewed PvP-only behavior that is
absent from the donor-only engine. `scripts/integrate-vsai-with-pvp-contracts.py`
verifies approved SHA and round-trip fidelity. If a new donor changes any
anchored contract, the integration fails closed until reviewed, rather than
silently deleting old multiplayer fixes. Donor content changes have their own
parity tests, independent of fixed networking behavior.

**Release decision**: source QA-passing STAGING / release candidate; not
production STABLE until the external acceptance checklist passes.
