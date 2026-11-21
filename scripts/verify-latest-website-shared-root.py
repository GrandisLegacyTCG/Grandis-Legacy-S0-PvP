#!/usr/bin/env python3
"""Verify the unpublished full Website repo against PvP's shared-assets contract.

Usage:
  python3 scripts/verify-latest-website-shared-root.py PATH_TO_FULL_WEBSITE_ZIP
  python3 scripts/verify-latest-website-shared-root.py PATH_TO_EXTRACTED_WEBSITE_ROOT

No files are written. All 250 current /card-art/ and 109 shared binary paths
must match the exact bytes PvP expects; a stale GitHub branch is not accepted
as a substitute for the newest local full-repository source archive.
"""
from __future__ import annotations
import hashlib
import json
import sys
import zipfile
from pathlib import Path

LOCK = Path(__file__).with_name('website-shared-assets-lock.json')
ANCHOR = 'card-art/S0-ARC-001.webp'


def verify(package: Path):
    contract = json.loads(LOCK.read_text(encoding='utf8'))
    expectations = {}
    for rec in contract['sharedBinary'].values():
        expectations[rec['root'].lstrip('/')] = rec['sha256']
    for rec in contract['sharedArtwork'].values():
        expectations[rec['root'].lstrip('/')] = rec['sha256']
    assert len(contract['sharedArtwork']) == 250
    assert len(contract['sharedBinary']) == 109
    assert len(expectations) <= 359
    required_runtime = [r.lstrip('/') for r in contract.get('websiteRuntimeRequired', [])]

    if package.is_dir():
        if (package / ANCHOR).is_file(): root=package
        else:
            choices = [p.parent.parent for p in package.glob('*/'+ANCHOR)]
            if len(choices) != 1:
                raise RuntimeError('Could not locate a unique website root containing '+ANCHOR)
            root=choices[0]
        def load(rel):
            p=root/rel
            return p.read_bytes() if p.is_file() else None
        source_desc=str(root)
        def cleanup(): pass
    elif package.is_file() and zipfile.is_zipfile(package):
        z=zipfile.ZipFile(package)
        members=set(z.namelist())
        choices=[n[:-len(ANCHOR)] for n in members if n.endswith(ANCHOR)]
        if len(choices)!=1:
            raise RuntimeError('Expected one Website source root in ZIP with /'+ANCHOR+', got '+str(len(choices)))
        prefix=choices[0]
        def load(rel):
            n=prefix+rel
            return z.read(n) if n in members else None
        source_desc=str(package)+' (root prefix '+repr(prefix)+')'
        def cleanup(): z.close()
    else:
        raise RuntimeError('Input must be a full Website repository ZIP or extracted directory')
    try:
        errors=[]
        for rel,expected in sorted(expectations.items()):
            data=load(rel)
            if data is None:
                errors.append('MISSING '+rel)
            elif hashlib.sha256(data).hexdigest() != expected:
                errors.append('HASH MISMATCH '+rel)
        for rel in required_runtime:
            if load(rel) is None:
                errors.append('REQUIRED SITE RUNTIME MISSING '+rel)
        if errors:
            print('FAIL shared-asset preflight for '+source_desc)
            for e in errors[:80]: print('  '+e)
            if len(errors)>80: print('  ... '+str(len(errors)-80)+' additional errors')
            raise SystemExit(1)
        print('PASS: verified 250 card artworks + 109 shared-binary references; required root scripts/CSS present.\nRoot: '+source_desc)
    finally:
        cleanup()

if __name__=='__main__':
    if len(sys.argv)!=2:
        raise SystemExit('Usage: verify-latest-website-shared-root.py FULL_WEBSITE_REPO.zip | WEBSITE_ROOT_DIR')
    verify(Path(sys.argv[1]))
