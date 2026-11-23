#!/usr/bin/env python3
"""Convert the staged /pvp/ website subtree to the verified shared-root asset contract.

This module never modifies gameplay rules, WebSocket code, or the standalone
backend. It removes only assets whose bytes are locked as identical to the
existing website root; all approved 250 card artworks resolve to /card-art/ in the latest full website root.
"""
from __future__ import annotations
import hashlib
import json
import posixpath
import re
from pathlib import Path

LOCK = Path(__file__).with_name('website-shared-assets-lock.json')
CARD_PATTERN = re.compile(r'(?<![\w/])(?:battle/)?card-art/(?P<id>S0-[A-Z0-9-]+)\.webp')
QUOTED_URL_PATTERN = re.compile(r'''(?P<q>["'`])(?P<ref>[^"'`<>\r\n]*?\.(?:png|webp|jpe?g|gif|svg|mp3|woff2?)(?:\?[^"'`<>\r\n]*)?)(?P=q)''')
TEXT_EXTENSIONS = {'.js', '.css', '.html', '.json', '.mjs'}


def digest_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def replace_exact_once(txt: str, old: str, new: str, context: str) -> str:
    n=txt.count(old)
    if n!=1: raise RuntimeError(f'{context}: expected exactly 1 occurrence, got {n}: {old[:90]}')
    return txt.replace(old,new)


def relative_source_for_text(file: Path, root: Path) -> str:
    return 'pvp/' + file.relative_to(root).as_posix()


def rewrite_shared_resource_refs(txt: str, src: str, mappings: dict[str,str]) -> str:
    # CSS url(...) resolves from CSS file; HTML and JS runtime URLs resolve
    # from the actual browser page, not the location of the script file.
    if src.endswith('.css'):
        base=posixpath.dirname(src)
    elif src.startswith('pvp/battle/'):
        base='pvp/battle'
    else:
        base='pvp'

    def substitute(match):
        quote, value=match.group('q'),match.group('ref')
        if (value.startswith(('/','data:','#','http:','https:')) or '${' in value):
            return match.group(0)
        path,marker,query=value.partition('?')
        resolved=posixpath.normpath(posixpath.join(base,path))
        replacement=mappings.get(resolved)
        if replacement is None:
            return match.group(0)
        return f'{quote}{replacement}{marker+query if marker else ""}{quote}'

    return QUOTED_URL_PATTERN.sub(substitute,txt)


def patch_dynamic_art_sources(text: str, src: str) -> str:
    if src=='pvp/pvp/pvp-host.js':
        text=replace_exact_once(text,
            "function localCardArt(id){return id?'battle/card-art/'+encodeURIComponent(String(id))+'.webp':''}",
            "function localCardArt(id){return window.GL_PVP_CARD_ART_URL(id)}",
            src)
    if src=='pvp/pvp/db158-card-review.js':
        text=replace_exact_once(text,
            "image:'battle/card-art/'+c.card_id+'.webp'",
            "image:window.GL_PVP_CARD_ART_URL(c.card_id)", src)
    if src=='pvp/battle/shared-app/app-runtime.js':
        text=replace_exact_once(text,
            "function art(id){return id?'card-art/'+encodeURIComponent(id)+'.webp':'';}",
            "function art(id){return window.GL_PVP_CARD_ART_URL(id);}",src)
        text=replace_exact_once(text,
            "return 'card-art/'+(faces[name]||faces.Generic)+'.webp';",
            "return window.GL_PVP_CARD_ART_URL(faces[name]||faces.Generic);",src)
        text=replace_exact_once(text,
            "const GL_S0_HERO_ACTION_ICON_DIR='assets/ui/hero-actions/';",
            "const GL_S0_HERO_ACTION_ICON_DIR='/assets/ui/hero-actions/';",src)
        # PvP battle asset folders were shared into the website root; all dynamic
        # status/audio and Hand fallback paths need the same absolute routing.
        text=text.replace("'engine/assets/status-icons/Icon-'", "'/engine/assets/status-icons/Icon-'")
        text=text.replace("'engine/assets/audio/battle/'", "'/engine/assets/audio/battle/'")
        text=text.replace("const fallback='assets/ui/'", "const fallback='/assets/ui/'")
    if src=='pvp/battle/engine/shared-app/app.bundle.js':
        text=replace_exact_once(text,
            "file:'card-art/'+c.card_id+'.webp'",
            "file:window.GL_PVP_CARD_ART_URL(c.card_id)",src)
        # These paths are built with dynamic suffixes, so static path rewriting
        # alone cannot cover them. The targeted path family is byte-verified.
        text=text.replace("'engine/assets/status-icons/Icon-'", "'/engine/assets/status-icons/Icon-'")
        text=text.replace("'assets/counters/Counter-'", "'/engine/assets/counters/Counter-'")
        text=text.replace('"assets/lobby/Swap.png?v=', '"/engine/assets/lobby/Swap.png?v=')
    if src=='pvp/battle/runtime/season0-generated/rc42-main-deck-r398-overlay.js':
        text=replace_exact_once(text,
            "var local='card-art/'+id+'.webp';",
            "var local=window.GL_PVP_CARD_ART_URL(id);",src)
        # Dynamic review/preview registries must share the same root route;
        # explicit S0-* literals are handled above by CARD_PATTERN.
        text=replace_exact_once(text,
            "image:'card-art/'+id+'.webp'",
            "image:window.GL_PVP_CARD_ART_URL(id)",src)
        # New R3.98 overlay writes both preview and manifest records; both
        # dynamic file routes must use the shared website artwork resolver.
        dynamic_file="file:'card-art/'+id+'.webp'"
        count=text.count(dynamic_file)
        if count!=2: raise RuntimeError(f'{src}: expected two R3.98 dynamic card asset paths, got {count}')
        text=text.replace(dynamic_file,"file:window.GL_PVP_CARD_ART_URL(id)")
    if src=='pvp/battle/assets/review-db158/js/s0-review-clarity.js':
        text=replace_exact_once(text,
            "+'assets/keywords-review/'+name+'.png'",
            "+'/assets/keywords-review/'+name+'.png'",src)
    return text


def artwork_helper(local: dict[str,str]) -> str:
    if local: raise RuntimeError('Latest root-only website must not package local artwork')
    return ("/* PvP shared artwork: all 250 current cards already live at /card-art/. */\n"
            "(()=>{'use strict';\n"
            "window.GL_PVP_CARD_ART_URL=function(id){\n"
            " const raw=String(id||'').trim();\n"
            " if(!/^S0-[A-Z0-9-]+$/.test(raw))return '';\n"
            " return '/card-art/'+encodeURIComponent(raw)+'.webp';\n"
            "};\n})();\n")


def apply_shared_assets(site: Path) -> dict:
    site=site.resolve()
    if not (site/'index.html').is_file() or not (site/'battle/index.html').is_file():
        raise RuntimeError('Expected website /pvp/ subtree as input')
    contract=json.loads(LOCK.read_text(encoding='utf-8'))
    shared_bin=contract['sharedBinary'];shared_cards=contract['sharedArtwork'];local_cards=contract['pvpOnlyArtwork']
    if (len(shared_bin),len(shared_cards),len(local_cards))!=(109,250,0):
        raise RuntimeError('The approved site-root lock changed; explicit review is required')

    # Validate every shared file against its version-locked content digest.
    # If bytes differ, stop instead of removing a modified donor asset.
    removed_binary={}
    for rel,asset in shared_bin.items():
        source=site/rel
        if not source.is_file():raise RuntimeError(f'Missing expected shared source: {rel}')
        if digest_bytes(source.read_bytes())!=asset['sha256']:
            raise RuntimeError(f'Shared root binary content changed: {rel}. Re-audit before deploying.')
        removed_binary['pvp/'+rel]=asset['root']

    def card_route(card_id: str) -> str:
        if card_id in shared_cards:return '/card-art/'+card_id+'.webp'
        if card_id in local_cards:return '/pvp/battle/card-art/'+card_id+'.webp'
        raise RuntimeError(f'Unrecognized artwork ID in donor: {card_id}')

    card_dir=site/'battle/card-art'
    real_cards={p.stem:p for p in card_dir.glob('S0-*.webp')}
    if len(real_cards)!=250:raise RuntimeError(f'Expected 250 current donor artworks, found {len(real_cards)}')
    for card_id,art in real_cards.items():
        expected=shared_cards.get(card_id) or local_cards.get(card_id)
        if not expected or digest_bytes(art.read_bytes())!=expected['sha256']:
            raise RuntimeError(f'Changed / missing current card art: {card_id}')
    for card_id in shared_cards:real_cards[card_id].unlink()
    for rel in shared_bin:(site/rel).unlink()

    rewritten=[]
    binary_resolver={'pvp/'+rel:d['root'] for rel,d in shared_bin.items()}
    for path in site.rglob('*'):
        if not path.is_file() or path.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        src=relative_source_for_text(path,site)
        if src.startswith('pvp/docs/') or src.startswith('pvp/README'):
            continue
        original=path.read_text(encoding='utf-8')
        # First adapt explicit card IDs in generated manifests and catalogs.
        text=CARD_PATTERN.sub(lambda m:card_route(m.group('id')),original)
        # Rewrite only approved same-byte shared website assets. URL resolution
        # is relative to CSS file or browser document as appropriate.
        text=rewrite_shared_resource_refs(text,src,binary_resolver)
        text=patch_dynamic_art_sources(text,src)
        if original!=text:
            path.write_text(text,encoding='utf-8')
            rewritten.append(src)

    (site/'shared-artwork-urls.js').write_text(artwork_helper(local_cards),encoding='utf-8')
    lobby=site/'index.html';s=lobby.read_text(encoding='utf-8')
    s=replace_exact_once(s,'<script src="config.js"></script>',
        '<script src="shared-artwork-urls.js"></script>\n<script src="config.js"></script>','PvP Lobby helper script')
    lobby.write_text(s,encoding='utf-8')
    battle=site/'battle/index.html';s=battle.read_text(encoding='utf-8')
    s=replace_exact_once(s,'<script src="engine/shared-ui/battlefield-ui.js',
        '<script src="../shared-artwork-urls.js"></script>\n  <script src="engine/shared-ui/battlefield-ui.js','PvP Battle helper script')
    # The website route is /pvp/battle/, not /battle/. /build-meta.js does
    # not exist in the full website root and would silently break identity.
    s=replace_exact_once(s,'<script src="/build-meta.js"></script>',
        '<script src="../build-meta.js"></script>','PvP Battle site build metadata')
    battle.write_text(s,encoding='utf-8')

    info={
        'websiteRootOnly':True,
        'includedRootDirectory':'pvp/',
        'sharedBinaryFiles':len(shared_bin),
        'websiteRootArtwork':len(shared_cards),
        'pvpLocalArtwork':len(local_cards),
        'websiteCardArtworkTotal':len(shared_cards)+len(local_cards),
        'webRootRequired':contract['websiteRuntimeRequired'],
        'localArtworkIDs':sorted(local_cards),
        'sharedWebsiteSource':contract['approvedWebsiteSourceName'],
        'artworkReferenceVerifiedAgainst':contract['artworkReferenceVerifiedAgainst'],
        'websiteFullRepositoryDirectlyVerified':True,
        'changedTextFiles':rewritten,
        'safety':'The standalone backend retains all 250 local card art files. The website pvp/ contains NO artwork copies and relies on 250 latest shared-root card-art files.'
    }
    (site/'docs').mkdir(exist_ok=True)
    (site/'docs/SHARED_ASSETS_DEPLOYMENT.json').write_text(json.dumps(info,indent=2)+'\n',encoding='utf-8')
    return info


if __name__=='__main__':
    import sys
    if len(sys.argv)!=2:raise SystemExit('Usage: website-shared-assets.py /path/to/site-root/pvp')
    result=apply_shared_assets(Path(sys.argv[1]))
    print(json.dumps({k:v for k,v in result.items() if k not in ('changedTextFiles','localArtworkIDs')},indent=2))
