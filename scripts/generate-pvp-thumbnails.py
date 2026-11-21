#!/usr/bin/env python3
"""Generate public exact-card thumbnails from the approved PvP artwork only.

This changes no gameplay data and does not import cards from the Deck Builder.
The resulting JS can be served unchanged by standalone and website /pvp/.
"""
from pathlib import Path
from PIL import Image
import base64
import hashlib
import io
import json
import re

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'public/battle/card-art'
OUT = ROOT / 'public/battle/runtime/pvp-card-thumbnails.js'
FILES = sorted(ART.glob('S0-*.webp'))
if not FILES:
    raise SystemExit('No approved PvP WebP card assets found')
faces = {}
source_hash = hashlib.sha256()
for src in FILES:
    card_id = src.stem
    if not re.fullmatch(r'S0-[A-Z0-9-]+', card_id):
        raise SystemExit(f'Invalid card ID: {card_id}')
    original = src.read_bytes()
    source_hash.update(card_id.encode('ascii') + b'\x00' + hashlib.sha256(original).digest())
    with Image.open(io.BytesIO(original)) as im:
        if im.format != 'WEBP' or im.size[0] * 7 != im.size[1] * 5:
            raise SystemExit(f'Unexpected artwork format/aspect ratio: {src.name} {im.size} {im.format}')
        thumb = im.convert('RGBA').resize((96, 134), Image.Resampling.LANCZOS)
        buff = io.BytesIO()
        thumb.save(buff, format='WEBP', quality=68, method=6)
        tiny = buff.getvalue()
        with Image.open(io.BytesIO(tiny)) as test:
            if test.size != (96, 134) or test.format != 'WEBP':
                raise SystemExit(f'Thumbnail failed validation: {card_id}')
    faces[card_id] = 'data:image/webp;base64,' + base64.b64encode(tiny).decode('ascii')
manifest_hash = source_hash.hexdigest()[:16]
OUT.write_text('/* Generated from the approved PvP artwork only. Not a card-data donor. */\n'
               + 'window.GL_PVP_CARD_THUMBNAILS = Object.freeze(' + json.dumps(faces, separators=(',', ':')) + ');\n'
               + 'window.GL_PVP_CARD_THUMBNAIL_MANIFEST = Object.freeze(' + json.dumps({'hash': manifest_hash, 'count': len(faces), 'size': [96, 134]}, separators=(',', ':')) + ');\n', encoding='utf-8')
print(f'Generated {len(faces)} exact-card thumbnails; source hash {manifest_hash}; bundle {OUT.stat().st_size} bytes')
