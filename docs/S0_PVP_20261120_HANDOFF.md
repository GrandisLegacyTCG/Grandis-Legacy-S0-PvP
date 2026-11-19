# Season 0 PvP manual handoff — 20 Nov 2026

## Targets (only)
- Backend source: `GrandisLegacyTCG/Grandis-Legacy-S0-PvP`, branch `main`. Replace repository ROOT from the backend ZIP; do not nest folder.
- Website source: `GrandisLegacyTCG/Grandis-Legacy-S0-Website`, branch `main`. Overlay only the `pvp/` directory from the website ZIP.
- `https://grandislegacytcg.web.id/pvp/` -> `wss://p01--grandis-legacy-s0-pvp--2kwws8nzlcc2.code.run/ws`.
- `buildId` MUST remain `gl-s0-pvp-rc41-r39-v34-part5-2026-11-19` on both.
- Do NOT change/rename/push any repo/service automatically. Season 1 repo `Grandis-Legacy-PvP` untouched, and Room2 fallback stays online.

## Changed source
- `public/battle/shared-app/app-runtime.js` and `public/battle/runtime/pvp-mobile-landscape-fix.css`: mobile portrait card preview docked to logical 1600x747 PvP stage. No gameplay or websocket changes.
- `public/battle/index.html`: cache-bust changed presentation files without altering compatibility buildId.
- Regenerated HTTP Brotli/gzip sidecars. Existing backend root `/config.js` stays same-origin.

## Limitations / acceptance
- VS AI donor AI Intermediate tactical decision changes were deliberately **not merged**; human PvP does not execute AI decision policies.
- VS AI's portrait flying-card `mobileFlightRect()` transformation was **not merged**: PvP transforms the whole BODY, not isolated viewport portals. Double rotation would break its flights.
- Native server and remote WSS full-match acceptance still requires human two-browser production testing. Do not claim that local WS fallback tests prove live Northflank play.
- Historical docs include old repo names and old Northflank Room2 and are archival only.
