# Grandis Legacy Season 0 PvP - Stage 3 handoff

**Deliverables are exactly two independent ZIP archives.** Deploy manually; no
GitHub, hosting, or live website changes are performed by this build.

1. **Standalone backend repository**: extract the backend ZIP directly to the
   root of `GrandisLegacyTCG/Grandis-Legacy-S0-PvP`. It contains `server.js`,
   `server/`, `public/`, `scripts/`, `tests/`, `.github/`, `Dockerfile`, and
   production `package.json` / lockfile. It is self-contained, including current
   in-game artwork, starter exports and PvP multiplayer bridge contracts.
2. **Website root PvP only**: extract the website ZIP at the root of the
   EXISTING website repository so its only top-level directory is `pvp/`. It
   does not replace the homepage, VS AI, Deck Builder, or shared website root
   art. Current PvP artwork is shared from the latest website-root
   `/card-art/` directory. PvP does not duplicate the 250 game artworks.
   Other assets are reused from `/assets/`, `/engine/assets/`, and `/deck-builder/`.

## Clean-root GitHub repository upload

This backend ZIP is **repository-root ready**. Its root contains `Dockerfile`,
`server.js`, `package.json`, `package-lock.json`, `.github/`, `server/`,
`public/`, `scripts/`, `tests/`, and `docs/` directly. There is NO wrapping
`backend/` directory, NO website-only `pvp/` directory, and NO top-level
`site-overlay/`. The website packaging support stylesheet lives under
`scripts/website-overlay/pvp/`, so the website generator remains usable.

When the repository has been cleared by the owner, extract all contents of
this archive directly to the **root** of
`GrandisLegacyTCG/Grandis-Legacy-S0-PvP`, not into a new subfolder. Keep
hidden files such as `.dockerignore`, `.gitignore`, and `.github/`. Verify the
layout using `python3 scripts/verify-clean-root.py BACKEND.zip` before upload.
The owner's Website-only archive remains separate and is NOT part of this repo.

## Matching build contract

- Version: `S0-PVP-STAGE3-RC42-R394-20261122-A`
- Build ID: `gl-s0-pvp-stage3-rc42-r394-20261122-a`
- Gameplay reference: approved VS AI Season 0 RC42, Main Deck R3.94 and
  Rulebook 3.5 for the integrated rules and new card definitions.
- Starter Decks: five official source exports, each with exactly 50 Main,
  12 Mana and 12 Legacy cards. Lobby and server decks are validated against
  the exact owner's exported JSON SHA-256. See
  `tests/stage3-official-starters-and-artwork.mjs`.
- Full card artwork: 250 local WebP assets, including `Cheers!` and
  `Fire Flask`, plus matching embedded thumbnails. The newest unpublished full Website
  source already contains all 250 `/card-art/` files. The older live GitHub
  main branch is NOT the source of truth for this asset inventory.

## Preserved multiplayer contracts

The donor's game mechanics and display improvements are incorporated through
an approved, reversible compatibility integration. The server remains the
single gameplay authority. Seat 1 and Seat 2 use the same game engine while
network behavior, exact Mana selections, Response and pending continuation,
seat-private Hands and Mana identities, Card Played public notices, duplicate
intent IDs, reconnection, and spectator privacy are owned by PvP code.

- To verify approved donor provenance and reversible PvP-only adaptations:
  `python3 scripts/integrate-vsai-with-pvp-contracts.py --verify`
- To check the documented donor source hashes:
  `node tests/rc41-release-integrity.mjs`
- Never replace the PvP donor bundle by raw copy without first reviewing and
  preserving `server/compat/*.inc` and passing all multiplayer regression gates.
- Archived donor documentation, including old RC40/RC41 release notes, remains
  in `docs/` for history only; it is not a deploy target.

## Local verification

Tested locally using Node and the included RFC6455 test transport:

```
node scripts/run-rc41-release-check.mjs   # 50/50 historical network tests
npm run check:rc41                     # headless, seat mirror, two-seat WS QA, F15/F19
npm run test:stage1-network             # attack continuation and exact commit
npm run test:stage2                     # instant art, Hand, Card Review, Casting, buttons
npm run test:stage3                     # five source-verified starters, 250 art, site-only
python3 scripts/integrate-vsai-with-pvp-contracts.py --verify
npm run build:precompress
```

An additional real Chromium local DOM/artwork smoke test confirmed that an
owned known card displays its decodable exact-card thumbnail immediately,
without waiting for the full-resolution fetch. This test is not a substitute
for a real two-browser gameplay session on the deployed backend.

**Important limitation**: this environment could not download the production
`ws` dependency (`npm ci` blocked by DNS restrictions). Therefore the tested
WebSocket transport locally was the included RFC6455 fallback, **not** native
`ws`. External production WSS, native `ws` inside Docker, complete live
human-versus-human matches, and cross-browser/mobile display are **not yet
verified**. The artifacts are a **QA-passing release candidate**, not a claim
of certified bug-free production stability.

## Deployment / external acceptance gate

1. Deploy backend manually as a **single replica** with `PVP_REQUIRE_WS=1`,
   `PVP_ALLOWED_ORIGINS=https://grandislegacytcg.web.id`, and a current Node
   runtime. Use `npm ci --omit=dev --ignore-scripts` (or the Dockerfile).
2. Verify `GET /health` returns the correct build ID, version, `ok:true`,
   and `transport:"ws"`. Do not proceed if any field differs.
3. Deploy **only** the website ZIP's `pvp/` folder. The included
   `pvp/config.js` points to the previously approved WSS host. Verify that
   the same host is actually running the current backend; adjust the config
   if the user's real deployment has a different hostname.
4. Open two independent browsers/tabs as Player 1 and Player 2. Confirm
   entering Lobby, official Starter Deck selection, both READY, coin flip,
   opening Hand art, turns, Skill/Item, attacker/defender Response, Mana Burn
   and Steal after Attack, exact Mana selection CONFIRM, Card Review repeated
   opening/closing, Swap/SKIP, Casting onto a Legacy position, end-of-match,
   reconnect and hidden-info privacy. Test mobile viewport separately.
5. If any critical behavior fails, do not label the release STABLE. Report
   the client console and backend action/revision logs; patch the proper PvP
   boundary, add a regression test, and run all gates again.
