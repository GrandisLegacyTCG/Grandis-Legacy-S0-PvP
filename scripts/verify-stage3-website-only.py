#!/usr/bin/env python3
"""Stage 3: build the website-only tree and validate the network/frontend contract."""
import hashlib
import importlib.util
import json
import re
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('site_build', ROOT / 'scripts/build-website-root-only.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

with tempfile.TemporaryDirectory(prefix='grandis-pvp-website-stage3-') as temp:
    output = Path(temp)
    module.build(output)
    assert sorted(p.name for p in output.iterdir()) == ['PVP_WEBSITE_MANIFEST.json', 'pvp']
    site = output / 'pvp'
    meta = json.loads((output / 'PVP_WEBSITE_MANIFEST.json').read_text())
    build = meta['build']
    assert build['buildId'] == 'gl-s0-pvp-rc42-r398-r40-20261124-a'
    assert build['version'] == 'S0-PVP-RC42-R398-R40-20261124-A'
    assert build['buildId'] in (site / 'index.html').read_text()
    assert build['buildId'] in (site / 'battle/index.html').read_text()
    assert build['buildId'] in (site / 'build-meta.js').read_text()
    assert meta['websiteRootArtwork'] == 250
    assert meta['pvpLocalArtwork'] == 0
    assert meta['sharedBinaryFiles'] == 109
    assert len(list((site / 'battle/card-art').glob('S0-*.webp'))) == 0
    for new_id in ('S0-EVT-013', 'S0-ITM-021'):
        assert not (site / 'battle/card-art' / (new_id+'.webp')).is_file()
        assert (new_id+'.webp') not in [p.name for p in (site / 'battle/card-art').glob('*.webp')]
        assert new_id in (site / 'battle/runtime/pvp-card-thumbnails.js').read_text()
    helper=(site / 'shared-artwork-urls.js').read_text()
    assert "'/card-art/'" in helper and 'GL_PVP_CARD_ART_URL' in helper
    assert not any(p.is_file() for p in (site / 'battle/card-art').glob('*.webp'))
    config = (site / 'config.js').read_text()
    assert "wsBase:'wss://" in config and "wsPath:'/ws'" in config
    lobby = (site / 'pvp/pvp-host.js').read_text()
    assert "'/pvp/battle/" in lobby and 'GL_PVP_CARD_ART_URL' in lobby
    assert "'/battle/" not in lobby
    assert 'href="/deck-builder/"' in lobby and 'href="/vs-ai/"' in lobby
    assert 'gl-site-brand-img' in lobby
    assert 'gl-site-nav-btn--primary' in lobby
    assert (site / 'lobby/pvp-shared-header-20261120.css').is_file()
    for f in ('runtime/pvp-network.js',
              'runtime/pvp-artwork-loader.js', 'runtime/pvp-card-thumbnails.js',
              'shared-app/db158-card-review.js'):
        a = site / 'battle' / f
        b = ROOT / 'public/battle' / f
        assert a.is_file(), str(a)
        assert hashlib.sha256(a.read_bytes()).digest() == hashlib.sha256(b.read_bytes()).digest(), f+' website divergence'
    overlay_js=(site/'battle/runtime/season0-generated/rc42-main-deck-r398-overlay.js').read_text()
    assert 'var local=window.GL_PVP_CARD_ART_URL(id);' in overlay_js
    assert "var local='card-art/'" not in overlay_js
    assert "image:'card-art/'" not in overlay_js
    assert "file:'card-art/'" not in overlay_js
    assert 'image:window.GL_PVP_CARD_ART_URL(id)' in overlay_js
    assert 'file:window.GL_PVP_CARD_ART_URL(id)' in overlay_js
    # Every readable/previewed card, including newly added donor cards,
    # must use site-root artwork. Never leave relative card-art URLs that
    # would point to the deliberately absent /pvp/battle/card-art directory.
    for art_source in site.rglob('*'):
        if not art_source.is_file() or art_source.suffix not in ('.js','.json','.css','.html'):
            continue
        if art_source.name == 'shared-artwork-urls.js':
            continue
        content = art_source.read_text(encoding='utf-8')
        forbidden = re.search(r'(?<![A-Za-z0-9/])card-art/(?:S0-|[\"\']\s*\+)', content)
        assert forbidden is None, f'Relative card-art path would break shared asset routing: {art_source}'
    assert 'GL_PVP_CARD_ART_URL' in (site/'battle/shared-app/app-runtime.js').read_text()
    for p in site.rglob('*'):
        assert not p.name.endswith(('.br','.gz')), 'Website has stale compression sidecar: '+str(p)
    for html in (site / 'index.html', site / 'battle/index.html'):
        code=html.read_text()
        for rel in re.findall(r'<script[^>]+src="([^\"]+)', code):
            if rel.startswith(('http:', 'https:', '//')):
                raise AssertionError('Unexpected remote script '+rel)
            path=rel.split('?',1)[0]
            if path.startswith(('/assets/', '/engine/assets/', '/card-art/', '/deck-builder/')):
                continue  # Shared website-root files already deployed by owner.
            if path.startswith('/'):
                assert (site / path.lstrip('/')).is_file(), rel
            else:
                assert (html.parent / path).is_file(), rel
    print('STAGE 3 WEBSITE PASS: only /pvp/, 250 shared artwork, no duplicate cards, 109 other assets shared, matching backend build, scoped links')
