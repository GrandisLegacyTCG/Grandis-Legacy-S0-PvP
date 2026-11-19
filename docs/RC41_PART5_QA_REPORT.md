# PvP Season 0 RC41 Part 5 — verified local QA (19 Nov 2026)

| Gate | Result |
|---|---|
| VS AI RC41 donor modules static-data/runtime-authority/active-starters | 3/3 byte-exact hashes |
| Audited RC41 app.bundle PvP-only changes | SHA-pinned and documented |
| Gameplay F01–F12 donor regression | 20/20 pass |
| Additional retained PvP game/network/privacy regressions | 50/50 pass |
| Mirrored both-seat Mana physical pools/decks + canonical privacy | Pass |
| PvP seat2 PAY, Response and Mana loss presentation | Pass |
| WS lobby/reconnect/origin gating, seat privacy, server responses | Pass (local fallback WS) |
| Browser opponent Mana pool geometry | 4/4 Chromium viewports pass |
| Root website shared artwork | 248/248 matching SHA-256, no PvP duplication |
| Backend standalone artwork | 248, single directory |
| Full native `ws` Docker build on GitHub/host | Not run locally (CI will test) |
| Real remote production two-browser full-match | Not run locally (deployment QA required) |

RC40 frozen source/hash and R3.7 old-print tests are archival and excluded from RC41 gate; see release README. The package is a complete release source for the Season 0 **trial** repository, not a statement that an untested deployment is production-certified.
