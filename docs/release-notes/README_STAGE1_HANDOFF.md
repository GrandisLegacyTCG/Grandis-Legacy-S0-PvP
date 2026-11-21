# Grandis Legacy PvP — Stage 1 standalone handoff

The complete release has two **separately uploaded** artifacts:

1. **Standalone backend repository ZIP**: contents go at the **repository root** of `GrandisLegacyTCG/Grandis-Legacy-S0-PvP` (not inside an extra folder).
2. **Website root `pvp/` only ZIP**: contains only `pvp/...`, to be placed under the **existing** website repo root; no other website subtree is replaced.

See `docs/STAGE1_NETWORK_STABILIZATION.md` for the confirmed bug, adapter boundary, test results, shared asset assumptions, the required synchronized backend/frontend `buildId`, and the manual two-browser staging checklist.

Stage 1 fixes the known Attack-continuation Mana Burn/Steal atomic-commit regression and makes its tests permanent. **It does not** claim Hand rendering, Card Review, RC42 donor parity, or the two requested Lobby button fixes are completed. Those remain Stage 2. Live native `ws` and two-browser end-to-end certification remain Stage 3/release validation.

To reproduce the website-only staging folder from this backend:

```sh
python3 scripts/build-website-root-only.py --output ../website_root_only
```

Only upload the generated `../website_root_only/pvp/` contents to the existing website `/pvp/` folder. The site relies on root `/card-art/`, `/assets/`, `/engine/assets/` and the currently approved WSS host; these external root paths are **not** in the package.

Do not let CI test completion alone imply the network version is production-certified: GitHub Actions/Docker/native ws, WSS origin, and browser smoke tests must all pass after user deployment.
