import assert from 'node:assert/strict';
import {join} from 'node:path';
import {Season0HeadlessAuthority} from '../server/headless-rc32.mjs';
import {season0StarterCatalog} from '../server/s0-pregame-catalog.mjs';
import {viewerSafeBoard,assertViewerSafeBoard} from '../server/viewer-safe.mjs';
const ids=Object.keys(season0StarterCatalog);
assert.deepEqual(ids,['s0_starter_01_blue_red','s0_starter_02_yellow_blue','s0_starter_03_red_white','s0_starter_04_green_yellow','s0_starter_05_white_green']);
for (const first of [1,2]) {
 const a=new Season0HeadlessAuthority(join(process.cwd(),'public/battle'));
 a.start({player1Deck:season0StarterCatalog[ids[0]].deck,player2Deck:season0StarterCatalog[ids[1]].deck});
 a.completeOpening(first,'HEADS');
 const initial=a._canonicalForServerOnly().appState;
 assert.ok(initial);
 for (let i=0;i<5;i++) {
   let st=a._canonicalForServerOnly().appState;
   const actor=st.turn==='PLAYER'?1:2;
   if(st.phase==='End')break;
   a.applyIntent(actor,'advancePhase',[]);
 }
 for(const seat of [1,2]){
  const masked=viewerSafeBoard(a._viewForMaskingOnly(seat),{seat,revision:a.revision,secret:Buffer.alloc(32)});
  assertViewerSafeBoard(masked);
 }
 console.log('PASS authority first seat',first,'revision',a.revision);
}
