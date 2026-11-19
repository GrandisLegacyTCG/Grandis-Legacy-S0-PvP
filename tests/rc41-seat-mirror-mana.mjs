import assert from 'node:assert/strict';
import {join} from 'node:path';
import {Season0HeadlessAuthority} from '../server/headless-rc32.mjs';
import {season0StarterCatalog as decks} from '../server/s0-pregame-catalog.mjs';
import {viewerSafeBoard, assertViewerSafeBoard} from '../server/viewer-safe.mjs';
const ids=Object.keys(decks);
const root=join(process.cwd(),'public/battle');
const norm=x=>JSON.parse(JSON.stringify(x));
const remapOwner=x=>norm(x).map(sh=>({...sh,owner_side:sh.owner_side==='PLAYER'?'AI':sh.owner_side==='AI'?'PLAYER':sh.owner_side}));
for (const first of [1,2]) {
 const a=new Season0HeadlessAuthority(root);
 a.start({player1Deck:decks[ids[0]].deck,player2Deck:decks[ids[1]].deck});
 a.completeOpening(first,'HEADS');
 for(let step=0;step<4;step++) {
  const x=a._canonicalForServerOnly().appState;
  const p=a._viewForMaskingOnly(1).appState;
  const q=a._viewForMaskingOnly(2).appState;
  assert.deepEqual(norm(p.playerManaPoolCards),remapOwner(q.aiManaPoolCards),'Seat2 must mirror seat1 physical pool');
  assert.deepEqual(norm(p.aiManaPoolCards),remapOwner(q.playerManaPoolCards),'Seat2 must own physical pool');
  assert.deepEqual(norm(p.playerManaDeck),remapOwner(q.aiManaDeck),'Seat2 must mirror seat1 physical deck');
  assert.deepEqual(norm(p.aiManaDeck),remapOwner(q.playerManaDeck),'Seat2 must own physical deck');
  assert.equal(p.playerManaDeckCount,q.aiManaDeckCount);
  assert.equal(p.aiManaDeckCount,q.playerManaDeckCount);
  assert.deepEqual(norm(p.playerManaClasses),norm(q.aiManaClasses));
  assert.deepEqual(norm(p.aiManaClasses),norm(q.playerManaClasses));
  assert.equal(p.turn==='PLAYER'?'AI':'PLAYER',q.turn);
  for (const seat of [1,2]) {
   const safe=viewerSafeBoard(a._viewForMaskingOnly(seat),{seat,revision:a.revision,secret:Buffer.alloc(32,2)});
   assertViewerSafeBoard(safe);
   assert.ok(safe.appState.aiHand.every(c=>c==='__HIDDEN_CARD_BACK__'),'Opponent Hand masked');
  }
  if(x.phase==='End')break;
  const actor=x.turn==='PLAYER'?1:2;
  a.applyIntent(actor,'advancePhase',[]);
 }
 console.log('PASS RC41 seat mirror with physical Mana shards first='+first);
}
