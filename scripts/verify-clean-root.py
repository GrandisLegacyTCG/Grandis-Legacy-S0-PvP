#!/usr/bin/env python3
"""Validate a clean-root ZIP intended for GrandisLegacyTCG/Grandis-Legacy-S0-PvP.

Usage: python3 scripts/verify-clean-root.py path/to/backend.zip
"""
import sys
import zipfile
from pathlib import PurePosixPath

REQUIRED = {
    '.dockerignore', '.gitignore', '.github/workflows/qa.yml',
    'Dockerfile', 'docs/release-notes/README.md', 'package.json', 'package-lock.json',
    'server.js', 'server/headless-rc32.mjs', 'server/viewer-safe.mjs',
    'public/index.html', 'public/battle/index.html',
    'scripts/precompress-static.mjs',
}
ROOT_DIRS = {'.github', 'docs', 'public', 'scripts', 'server', 'tests'}
ROOT_FILES = {'.dockerignore', '.gitignore', 'Dockerfile', 'package.json',
              'package-lock.json', 'server.js'}

def main(filename):
    with zipfile.ZipFile(filename) as z:
        files = [p for p in z.namelist() if not p.endswith('/')]
        bad = [p for p in files if PurePosixPath(p).is_absolute()
               or '..' in PurePosixPath(p).parts or '\\' in p]
        assert not bad, f'Unsafe paths: {bad[:5]}'
        assert len(files) == len(set(files)), 'Duplicate ZIP members'
        missing = REQUIRED - set(files)
        assert not missing, f'Missing repository-root files: {sorted(missing)}'
        first = {p.split('/')[0] for p in files}
        extras = sorted(x for x in first if x not in ROOT_DIRS
                        and x not in ROOT_FILES
                        )
        assert not any(p.startswith('README') for p in first), 'README files are not allowed at root'
        assert not extras, f'Unexpected root paths: {extras}'
        disallowed = [p for p in files if p.startswith((
            'site-overlay/', 'node_modules/', '.git/', 'pvp/', 'website-root/'))
            or '/__pycache__/' in p or p.endswith(('.zip', '.rar', '.pyc'))]
        assert not disallowed, f'Disallowed archive content: {disallowed[:10]}'
        assert 'scripts/website-overlay/pvp/lobby/pvp-shared-header-20261120.css' in files, \
            'Website packaging support missing'
        print(f'PASS clean repo root: {len(files)} files; root={sorted(first)}')

if __name__ == '__main__':
    if len(sys.argv) != 2: sys.exit('Usage: verify-clean-root.py BACKEND.zip')
    main(sys.argv[1])
