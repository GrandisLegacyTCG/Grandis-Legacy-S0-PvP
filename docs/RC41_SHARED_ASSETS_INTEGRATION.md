# Shared assets reconciliation

{
  "scope": "Season 0 PvP-Trial only; Season 1 untouched",
  "artworkRootWebsiteSource": "Grandis_Legacy_Website_FULL_REPO_RC41_DB167_Starter_Swap_2_3_2026-11-18.zip",
  "rootWebsiteArtworkCount": 248,
  "websiteArtworkHashesMatchingBackend": 248,
  "backendArtworkLocation": "public/battle/card-art/ (248 unique files)",
  "websiteArtworkLocation": "/card-art/ (external shared website root; no copies in /pvp/)",
  "websiteCodeFilesWithArtworkUrlChanges": [
    "pvp/pvp/pvp-host.js",
    "pvp/pvp/db158-card-review.js",
    "pvp/pvp/s0-lobby-review-catalog.js",
    "pvp/battle/shared-app/app-runtime.js",
    "pvp/battle/shared-app/db158-card-review.js",
    "pvp/battle/assets/review-db158/js/db166-view-model.js",
    "pvp/battle/engine/shared-app/app.bundle.js",
    "pvp/battle/engine/js/static-data.js",
    "pvp/battle/runtime/season0-generated/s0-card-definitions.json",
    "pvp/battle/runtime/season0-generated/s0-asset-manifest-stage4.json"
  ],
  "frontendDynamicFallback": "/assets/js/s0-artwork-fallback.js",
  "deploymentPrecondition": "Root website RC41 with /card-art/ and shared fallback must already exist.",
  "status": "Asset integration revised; network/browser gameplay full certification still pending."
}
