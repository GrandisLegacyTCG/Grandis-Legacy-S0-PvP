#!/usr/bin/env python3
"""Create the owner-uploadable public standalone source ZIP, excluding hydrated binary aliases and internal reports.

Usage: python3 scripts/package-public-standalone.py /absolute/path/to/Grandis_PvP_PUBLIC.zip
Does not push, deploy, or change any gameplay source.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import subprocess
import sys
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent
if len(sys.argv) != 2:
    raise SystemExit('Usage: python3 scripts/package-public-standalone.py <output.zip>')
OUTPUT = Path(sys.argv[1]).expanduser().resolve()
if OUTPUT.is_relative_to(ROOT):
    raise SystemExit('Output must be OUTSIDE the repository root to avoid recursive packaging')
subprocess.run(['node', str(ROOT / 'tests/public-package-hygiene.mjs')], cwd=ROOT, check=True)
manifest = json.loads((ROOT / 'scripts/asset-dedup-manifest.json').read_text())
aliases = {'public/' + alias for group in manifest['groups'] for alias in group['aliases']}
assert len(aliases) == manifest['replacedAssetFiles']

# Deny internal notes regardless of later development artifacts accidentally added to the checkout.
def should_exclude(rel: str) -> bool:
    parts = rel.split('/')
    lower = rel.lower()
    if any(p in {'.git','node_modules','__pycache__','.pytest_cache','.generated'} for p in parts):
        return True
    if rel in aliases or rel == '.DS_Store':
        return True
    if rel.startswith('docs/') and rel != 'docs/NETWORK_RULES.md':
        return True
    if rel.startswith('public/docs/') or rel in ('public/battle/README.md','public/battle/engine/shared-ui/README.md'):
        return True
    if lower.endswith(('.log','.pem','.key','.pfx','.p12','.pyc','.bak','.zip')):
        return True
    if any(p == '.env' or p.startswith('.env.') for p in parts):
        return True
    if rel.startswith('tests/') and (rel.endswith('_RESULTS.json') or rel == 'tests/RC34_PVP_REGRESSION.json'):
        return True
    return False

paths = sorted(p for p in ROOT.rglob('*') if p.is_file() and not should_exclude(p.relative_to(ROOT).as_posix()))
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(OUTPUT, 'w', ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
    for path in paths:
        arcname = path.relative_to(ROOT).as_posix()
        archive.write(path, arcname)
with ZipFile(OUTPUT) as archive:
    names = set(archive.namelist())
    assert not aliases & names, 'Hydrated binary duplicates unexpectedly included'
    assert 'docs/NETWORK_RULES.md' in names
    assert 'README.md' in names
    assert not any(n.startswith('public/docs/') for n in names)
    assert archive.testzip() is None, 'ZIP CRC integrity failed'
    print(json.dumps({'ok':True,'zip':str(OUTPUT),'files':len(names),'compressedMiB':round(OUTPUT.stat().st_size/1048576,2),
                      'binaryAliasesExcluded':len(aliases),'documentation':['README.md','docs/NETWORK_RULES.md']},indent=2))
