#!/usr/bin/env python3
"""Build boundary adapter: preserve proven PvP two-seat snapshot mirroring.

The donor game mechanics are taken from the current VS AI engine. Its shared
legacy bundle also includes a PvP bridge. In the latest donor, the PvP bridge
lost critical seat-mirroring fields (Mana shard inventories and turn-stamped
maps). Restore JUST the verified PvP mirror subroutine from the last good PvP
source; reject unexpected donor ABI instead of accidentally dropping the lock.
"""
from pathlib import Path
import argparse,hashlib
p=Path(__file__).resolve().parents[1]
source=p/'public/battle/engine/shared-app/app.bundle.js'
good=p/'server/compat/pvp-snapshot-mirror.js.inc'
needle='  function glPvpSwapKeys(state){'
end='  function glPvpBridgeSnapshot(){'
new=source.read_text()
if new.count(needle)!=1 or new.count(end)!=1:raise SystemExit('Donor bundle bridge ABI changed; halt integration')
if good.is_file():
 fixed=good.read_text()
else:
 raise SystemExit('Known-good multiplayer bridge source unavailable; build must stop')
start=new.index(needle);stop=new.index(end,start)
if 'sw(\'playerManaPoolCards\',\'aiManaPoolCards\')' not in fixed or 'swapStampKeys' not in fixed:
 raise SystemExit('Regression lock incomplete')
source.write_text(new[:start]+fixed+new[stop:]);print('PvP mirror ABI locked:',hashlib.sha256(fixed.encode()).hexdigest()[:16])
