# Grandis Legacy — Season 0 PvP Standalone

**Status:** RC43 UI / PvP P01-P04 hotfix — Local QA Candidate. This source is not a claim of production stability.  
**Standalone UI donor reference:** **VS AI RC43 Standalone** (presentation reference only). This reference does **not** assert that the PvP gameplay engine has adopted every RC43 rules change.  
**Network ownership:** Independent PvP server-authoritative multiplayer. It must not be overwritten by VS AI integration.

## What this repository contains

- A complete standalone PvP server, authoritative gameplay adapter and two-seat WebSocket implementation.
- Self-contained Lobby, Battlefield, card artwork, thumbnail-first loading, static UI and local assets.
- Automated gameplay/network/privacy regression tests and public network engineering rules.

Private development notes, donor change histories, internal handoffs, QA screenshots/logs and internal release incident reports are intentionally **not included**. Network behavior and mandatory engineering rules remain public in [`docs/NETWORK_RULES.md`](docs/NETWORK_RULES.md).

## Install and run

Requires Node.js 22. In this standalone package, the static binary duplicate-asset aliases are restored before the server starts.

```bash
npm ci --omit=dev --ignore-scripts --no-audit --no-fund
npm start
```

**Always use `npm start` for the extracted ZIP**, or run `npm run prepare:assets` before using `node server.js` directly. `npm run verify:assets` checks that original public asset paths have been restored. `npm run check` runs the active local regression suite; `npm run check:publication` verifies public-repo documentation hygiene.

The server serves the Lobby at `/`, Battlefield at `/battle/`, WebSocket at `/ws`, and health information at `/health`. The included Dockerfile installs the required native WebSocket implementation, hydrates local binary aliases and precompresses static files.

## Production requirements

- Use secure HTTPS/WSS behind an appropriate reverse proxy and configure allowed browser origins (`PVP_ALLOWED_ORIGINS`).
- Set `PVP_REQUIRE_WS=1` to enforce native WebSocket transport in production.
- Deploy **one replica** while match state is held in memory; multiple independent replicas would split room authority.
- Treat reconnect tokens as secrets; do not hardcode credentials, session tokens or privileged debugging data into this public repository.
- Validate `/health` and the build/protocol compatibility of the separately deployed website client.
- Run real two-browser, both-seat and reconnect acceptance before promoting any release to **Stable**.

## Deployment pairing

The separate Website package contains only a `pvp/` subtree. It uses root-owned Website artwork/assets where appropriate, while **this standalone package is self-contained**. Website and Standalone clients must use the same compatible build and protocol; the Website uses the approved remote `wss://` endpoint, whereas Standalone uses same-origin `/ws`.

**Do not import AI autoplay, local gameplay authority or a donor network implementation into PvP.** Do not auto-upload or deploy on behalf of the owner.
