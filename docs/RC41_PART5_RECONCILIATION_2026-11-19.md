# RC41 reconciliation / integration contract

- Season 0 only (`Grandis-Legacy-PvP-Trial`), absolutely no Season 1 modifications.
- Gameplay source = VS AI RC41. Unchanged donor module checksums and 9 audited app.bundle diff sections establish exact donor parity except PvP-specific multiplayer mechanics, not a cosmetic RC41 rename.
- PvP multiplayer source = RC40 Patch 3.2, with targeted fixes for both-seat shard identity, Provoke End Phase, per-seat event mirroring, one-shot network responses, and PvP Mana notifications.
- Data R3.9, Rulebook v3.4, five active starter decks.
- Website `/pvp/` mirrors backend engine/network source; URLs point to shared `/card-art/`; backend standalone retains 248 card artworks under `public/battle/card-art/`.
- 20/20 gameplay donor checks, 50/50 compatibility/network checks and 4/4 viewport checks passed locally; 248/248 shared-art hashes checked.
- Native ws Docker deploy and live two-browser validation remain deployment-level verification, not substituted by unit tests.
