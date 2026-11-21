#!/usr/bin/env python3
"""Prepare ONLY the website's /pvp/ subtree from the tested standalone backend.

This script writes ONLY /pvp/ and its children to the website package.
The approved latest website source contains all 250 shared card artworks.
No website card-art binaries are duplicated inside the /pvp/ overlay.
The existing homepage/VS AI/Deck Builder and website-root shared assets
remain untouched. Gameplay source and network authority remain unchanged.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path
from website_shared_assets import apply_shared_assets

PROJECT = Path(__file__).resolve().parents[1]
SOURCE = PROJECT / 'public'
SITE_ADDITIONS = PROJECT / 'scripts' / 'website-overlay' / 'pvp'
SITE_WSS = 'wss://p01--grandis-legacy-s0-pvp--2kwws8nzlcc2.code.run'


def swap_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one source block, found {count}')
    return text.replace(old, new)


def edit(dest: Path, path: str, fn):
    file = dest / path
    before = file.read_text(encoding='utf-8')
    after = fn(before)
    if not after or not isinstance(after, str):
        raise RuntimeError(f'Failed to build {path}')
    file.write_text(after, encoding='utf-8')


def source_meta():
    src = (PROJECT / 'server.js').read_text(encoding='utf-8')
    version = re.search(r"const VERSION='([^']+)'", src)
    build_id = re.search(r"const BUILD_ID='([^']+)'", src)
    label = re.search(r"const BUILD_LABEL=`([^`]+)`", src)
    if not all((version, build_id, label)):
        raise RuntimeError('Cannot derive backend identity for website build-meta.')
    return {'version': version.group(1), 'versionLabel': label.group(1), 'buildId': build_id.group(1)}


def build(output_root: Path):
    if not SOURCE.is_dir() or not SITE_ADDITIONS.is_dir():
        raise RuntimeError('Backend public/ or scripts/website-overlay/pvp/ unavailable')
    output_root = output_root.resolve()
    if output_root in [SOURCE, PROJECT] or str(output_root).startswith(str(SOURCE) + '/'):
        raise RuntimeError('Cannot overwrite source/backend')
    dest = output_root / 'pvp'
    if dest.exists():
        shutil.rmtree(dest)
    output_root.mkdir(parents=True, exist_ok=True)

    def ignore(directory, names):
        current = Path(directory)
        names = set(names)
        skip = set()
        # Sidecars were compressed for backend originals; after URL rewrites the
        # originals differ. Never ship stale Brotli/Gzip sidecars to GitHub Pages.
        skip.update(x for x in names if x.endswith(('.br', '.gz')))
        return skip

    shutil.copytree(SOURCE, dest, ignore=ignore)
    shutil.copytree(SITE_ADDITIONS, dest, dirs_exist_ok=True)
    if len(list((dest / 'battle' / 'card-art').glob('S0-*.webp'))) != 250:
        raise RuntimeError('Website must contain all current artwork exclusively INSIDE /pvp/battle/card-art/')

    meta = source_meta()
    (dest / 'build-meta.js').write_text(
        'window.GL_PVP_BUILD_META=Object.freeze(' + json.dumps(meta, separators=(',', ':')) + ');\n', encoding='utf-8')
    # The fixed website WSS origin is inherited from the current approved
    # published /pvp/config.js, NOT from the local same-origin Node backend.
    (dest / 'config.js').write_text(
        "/* Static Website /pvp/ communicates only with the standalone PvP backend. */\n"
        "window.GL_PVP_CONFIG=Object.assign({\n"
        f"  wsBase:'{SITE_WSS}',\n"
        "  wsPath:'/ws',\n"
        "  homeUrl:'https://grandislegacytcg.web.id/',\n"
        "  vsAiUrl:'https://grandislegacytcg.web.id/vs-ai/',\n"
        "  deckBuilderUrl:'https://grandislegacytcg.web.id/deck-builder/'\n"
        "},window.GL_PVP_CONFIG||{});\n", encoding='utf-8')

    def site_lobby(html):
        html = swap_once(html, 'href="battle/engine/assets/favicon.png"',
                        'href="/engine/assets/favicon.png"', 'website lobby favicon')
        html = html.replace('<link rel="stylesheet" href="lobby/pvp-mobile-desktop.css',
                            '<link rel="stylesheet" href="lobby/pvp-mobile-desktop.css', 1)
        insertion = ('<link rel="stylesheet" href="/assets/css/gl-site-brand.css">\n'
                     '<link rel="stylesheet" href="/assets/css/gl-site-navigation.css">\n'
                     '<link rel="stylesheet" href="lobby/pvp-shared-header-20261120.css?v=20261120-smooth-1">\n'
                     '<script src="/assets/js/s0-artwork-fallback.js"></script>\n'
                     '<script defer src="/assets/js/gl-site-analytics.js?v=20261120-v1"></script>\n')
        return swap_once(html, '</head>', insertion+'</head>', 'website lobby head')

    edit(dest, 'index.html', site_lobby)

    def site_battle(html):
        html = swap_once(html, 'href="engine/assets/favicon.png"',
                         'href="/engine/assets/favicon.png"', 'website battlefield favicon')
        html = html.replace("url('assets/fonts/", "url('/assets/fonts/")
        html = html.replace("url('assets/ui/", "url('/assets/ui/")
        html = html.replace('src="assets/ui/', 'src="/assets/ui/')
        insertion = ('<script src="/assets/js/s0-artwork-fallback.js"></script>\n'
                     '<script defer src="/assets/js/gl-site-analytics.js?v=20261120-v1"></script>\n')
        return swap_once(html, '<script>window.GL_APP_MODE="PVP";', insertion+'<script>window.GL_APP_MODE="PVP";', 'website battlefield scripts')

    edit(dest, 'battle/index.html', site_battle)

    def site_host(js):
        js = js.replace("'/battle/", "'/pvp/battle/")
        if "'battle/card-art/'" not in js: raise RuntimeError('Website card art route unexpectedly changed')
        js = js.replace("'engine/assets/", "'/engine/assets/")
        # Keep the website's existing shared header unchanged. The requested
        # header/button styling work belongs to Stage 2, NOT Stage 1.
        old = ('<a id="pvpHomeLogo" class="pvp-v260-logo" aria-label="Back to Grandis Legacy home">'
               '<img src="assets/lobby/grandis-legacy-logo.webp" alt="Grandis Legacy"></a>')
        new = ('<a id="pvpHomeLogo" class="pvp-v260-logo gl-site-brand" href="/" aria-label="Back to Grandis Legacy home">'
               '<img class="gl-site-brand-img" src="/assets/site/web-s0/logo-transparent.webp" alt="Grandis Legacy"></a>')
        js = swap_once(js, old, new, 'website shared header logo')
        old = ('<nav class="pvp-v260-app-links" aria-label="Other Grandis Legacy games">'
               '<a class="pvp-v260-app-link pvp-v260-app-link--deck" href="https://grandislegacytcg.web.id/deck-builder/">GO TO DECK BUILDER</a>'
               '<a class="pvp-v260-app-link pvp-v260-app-link--vsai" href="https://grandislegacytcg.web.id/vs-ai/">GO TO VS AI</a></nav>')
        new = ('<nav class="pvp-v260-app-links gl-site-app-nav gl-lobby-website-links" aria-label="Other Grandis Legacy games">'
               '<a class="pvp-v260-app-link pvp-v260-app-link--deck gl-site-nav-btn gl-site-nav-btn--outline" href="/deck-builder/">GO TO DECK BUILDER</a>'
               '<a class="pvp-v260-app-link pvp-v260-app-link--vsai gl-site-nav-btn gl-site-nav-btn--primary" href="/vs-ai/">GO TO VS AI</a></nav>')
        js = swap_once(js, old, new, 'website shared header links')
        return js

    edit(dest, 'pvp/pvp-host.js', site_host)

    # Convert the result to the approved latest unpublished site-root assets
    # contract only AFTER all gameplay/frontend donor adaptations are applied.
    for f in ['pvp/pvp-host.js','battle/shared-app/app-runtime.js',
              'battle/runtime/season0-generated/rc42-main-deck-r394-overlay.js']:
        if 'card-art/' not in (dest/f).read_text():
            raise RuntimeError(f+' lost its card artwork route')
    host = (dest / 'pvp/pvp-host.js').read_text(encoding='utf-8')
    if "'/battle/" in host or "'battle/card-art/'" not in host or "'/pvp/battle/" not in host:
        raise RuntimeError('PvP website routing still points to backend-only paths')
    for path in ['index.html', 'battle/index.html']:
        html = (dest / path).read_text(encoding='utf-8')
        if meta['buildId'] not in html:
            raise RuntimeError(f'{path}: website static cache ID must match backend buildId')
    if (dest / 'pvp/pvp-host.js').read_text().count('gl-site-brand-img') != 1:
        raise RuntimeError('Website shared brand logo is missing or duplicated')
    info = apply_shared_assets(dest)
    for old_readme in sorted(dest.glob('README*.md')):
        (dest / 'docs').mkdir(exist_ok=True)
        old_readme.rename(dest / 'docs' / old_readme.name)
    info.update({'build': meta, 'rootOnly': '/pvp/', 'websiteRoot': str(output_root),
                 'siteWebSocket': SITE_WSS + '/ws'})
    (dest / 'docs').mkdir(exist_ok=True)
    (dest / 'docs/WEBSITE_PVP_DEPLOYMENT.md').write_text('# Grandis Legacy — PvP Website Overlay Deployment\n\nThis ZIP contains ONLY `pvp/` to insert into the **latest unpublished full\nWebsite repo** (`Grandis_Legacy_Website_FULL_REPO_NO_PVP_RC42_DB168_Rulebook35_2026-11-22.zip`).\nIt does not contain or replace Homepage, Deck Builder, VS AI, or any\nshared website-root assets.\n\n- All **250** current card artworks resolve to `/card-art/S0-*.webp`.\n- The 109 pre-existing shared visual/font/audio copies resolve to root `/assets/`,\n  `/engine/assets/`, and `/deck-builder/assets/` paths, as specified in\n  `docs/SHARED_ASSETS_DEPLOYMENT.json` and backend\n  `scripts/website-shared-assets-lock.json`.\n- The /pvp/ overlay includes no card artwork files. The root website is expected\n  to already include all 250 card files, including Cheers! and Fire Flask.\n- No website root assets are modified by this package; existing website\n  directories must not be deleted to upload this overlay.\n- PvP backend is independently standalone and retains all 250 local artworks.\n- Build ID in `pvp/build-meta.js` must match the backend build. WSS endpoint\n  in `pvp/config.js` must point to the live backend instance.\n\nIMPORTANT: The full latest unpublished Website source ZIP was not mounted in the\nPvP build environment. Card images have instead been verified byte-for-byte\nagainst the 250-file VS AI RC42 donor. Run the included backend verification\nscript against the actual latest website source ZIP before publishing.\nIf the source ZIP differs, fix the shared asset map instead of deploying broken\nasset links. Two-browser production WSS gameplay QA remains required.\n', encoding='utf-8')
    (output_root / 'PVP_WEBSITE_MANIFEST.json').write_text(json.dumps(info, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(info, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=PROJECT.parent / 'website_root_only')
    args = parser.parse_args()
    build(args.output)
