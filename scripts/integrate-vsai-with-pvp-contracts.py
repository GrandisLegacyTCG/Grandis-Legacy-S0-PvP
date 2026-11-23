#!/usr/bin/env python3
"""Fail-closed, reproducible VS AI -> PvP engine bridge integration.

Pure game mechanics come from the APPROVED donor. Only the proven PvP
multiplayer ABI compatibility contracts listed here are applied. The script
also supports round-trip integrity verification against the approved donor
SHA, preventing accidental overwrites or hidden source drift.
"""
import argparse
import hashlib
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
COMPAT=ROOT/'server/compat'
ENGINE=ROOT/'public/battle/engine/shared-app/app.bundle.js'
DONOR_SHA='18b6e1d5af711ca8041968bdd5f6ebdef445d8edbae4c5f736ea1bde32dec67f'

def load(name):
    path=COMPAT/name
    if not path.is_file():raise RuntimeError('Missing reviewed PvP compatibility snippet: '+name)
    return path.read_text()

def once(source,old,new,label):
    count=source.count(old)
    if count!=1:raise RuntimeError(f'{label}: expected one donor ABI anchor, found {count}; STOP integration')
    return source.replace(old,new)

def section(code,start,end):
    if code.count(start)!=1:raise RuntimeError('ABI anchor missing/ambiguous: '+start)
    a=code.index(start)
    b=code.index(end,a)
    return code[a:b]

def apply(source):
    # This is not a game mechanics patch. It protects server-side seat 2
    # mirroring of authoritative physical Shard inventories and turn stamps.
    source=once(source,load('donor-approved-mirror.js.inc'),load('pvp-snapshot-mirror.js.inc'),'seat mirror')
    source=once(source,load('donor-approved-mana-notices.js.inc'),load('pvp-committed-mana-notices.js.inc'),'PvP recipient-only committed Mana notice')
    source=once(source,load('donor-approved-public-pickup.js.inc'),load('pvp-public-pickup.js.inc'),'public physical Card Search pickup journal')
    for old,new in [
      ("recordPublicSelectedPickup(appState,p.side,id,'Main Deck',p.source_card_id,chosenHand.length-1);", "recordPublicSelectedPickup(appState,p.side,id,'Main Deck',p.source_card_id,chosenHand.length-1,p.commit_token);"),
      ("recordPublicSelectedPickup(appState,p.side,pid,'Discard',p.source_card_id,chosenHand.length-1);", "recordPublicSelectedPickup(appState,p.side,pid,'Discard',p.source_card_id,chosenHand.length-1,p.commit_token);")]:
        source=once(source,old,new,'committed Card Search action mapping')
    source=once(source,
      "if(Number(ability.cost||0)>0&&side==='PLAYER'&&['Crusader','Paladin']",
      "if(Number(ability.cost||0)>0&&(side==='PLAYER'||state.pvpHumanVsHuman)&&['Crusader','Paladin']",
      'seat 2 Class Ability Mana expense notice')
    source=once(source,'    applyServerIntent:function(intent,args){',load('exact-payment-api.js.inc')+'    applyServerIntent:function(intent,args){','atomic exact payment API')
    source=once(source,'        toggleResponseManaShardChoice:toggleResponseManaShardChoice,',load('exact-payment-intents.js.inc')+'        toggleResponseManaShardChoice:toggleResponseManaShardChoice,','atomic payment intent names')
    source=once(source,'    getCardPlayedDetail:function(side,eventId){',load('public-card-played-detail.js.inc')+'    getCardPlayedDetail:function(side,eventId){','safe public Card Played API')
    return source

def unapply(source):
    source=once(source,load('pvp-snapshot-mirror.js.inc'),load('donor-approved-mirror.js.inc'),'undo seat mirror')
    source=once(source,load('pvp-committed-mana-notices.js.inc'),load('donor-approved-mana-notices.js.inc'),'undo Mana notice')
    source=once(source,load('pvp-public-pickup.js.inc'),load('donor-approved-public-pickup.js.inc'),'undo public pickup')
    for old,new in [
      ("recordPublicSelectedPickup(appState,p.side,id,'Main Deck',p.source_card_id,chosenHand.length-1,p.commit_token);", "recordPublicSelectedPickup(appState,p.side,id,'Main Deck',p.source_card_id,chosenHand.length-1);"),
      ("recordPublicSelectedPickup(appState,p.side,pid,'Discard',p.source_card_id,chosenHand.length-1,p.commit_token);", "recordPublicSelectedPickup(appState,p.side,pid,'Discard',p.source_card_id,chosenHand.length-1);")]:
        source=once(source,old,new,'undo source action commit link')
    source=once(source,
      "if(Number(ability.cost||0)>0&&(side==='PLAYER'||state.pvpHumanVsHuman)&&['Crusader','Paladin']",
      "if(Number(ability.cost||0)>0&&side==='PLAYER'&&['Crusader','Paladin']",
      'undo Class Ability notice')
    source=once(source,load('exact-payment-api.js.inc'),'','undo payment API')
    source=once(source,load('exact-payment-intents.js.inc'),'','undo payment intents')
    source=once(source,load('public-card-played-detail.js.inc'),'','undo public card detail')
    return source

def sha(s):return hashlib.sha256(s.encode()).hexdigest()

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--donor',type=Path,help='Path to a candidate donor app.bundle.js')
    parser.add_argument('--output',type=Path,default=ENGINE)
    parser.add_argument('--verify',action='store_true',help='Validate current PvP bundle reversible source authenticity')
    parser.add_argument('--allow-new-donor',action='store_true',help='Require manual review of updated donor SHA; do not auto-approve')
    args=parser.parse_args()
    if args.verify:
        candidate=ENGINE.read_text()
        original=unapply(candidate)
        if sha(original)!=DONOR_SHA:raise RuntimeError(f'Integrated PvP source drifted from approved donor: {sha(original)} != {DONOR_SHA}')
        if apply(original)!=candidate:raise RuntimeError('Round-trip PvP compatibility mismatch')
        print('PASS approved donor byte-identical after reverse transform',DONOR_SHA)
        print('PASS reviewed PvP multiplayer bridge boundaries, derived bundle SHA',sha(candidate))
        return
    if not args.donor:raise RuntimeError('Provide --donor or --verify')
    original=args.donor.read_text()
    if sha(original)!=DONOR_SHA:raise RuntimeError(f'Unapproved donor SHA {sha(original)}; review and approve donor mechanics first')
    patched=apply(original)
    if unapply(patched)!=original:raise RuntimeError('PvP bridge transform is not reversible')
    args.output.write_text(patched)
    print('PASS reproducible PvP donor adaptation',sha(patched))

if __name__=='__main__':main()
