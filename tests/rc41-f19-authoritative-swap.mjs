import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {viewerSafeBoard,assertViewerSafeBoard} from '../server/viewer-safe.mjs';
const root=join(process.cwd(),'public/battle');
const src=readFileSync(resolve('server/headless-rc32.mjs'),'utf8');
const anchor='  /** A verified seat may concede without turn/response ownership. */';
assert(src.includes(anchor),'headless fixture hook anchor');
const source=src
 .replace("import {PvpCombatPresentationLedger} from './combat-presentation.mjs';",`import {PvpCombatPresentationLedger} from '${pathToFileURL(resolve('server/combat-presentation.mjs')).href}';`)
 .replace("import {PvpDiscardPresentationLedger} from './discard-presentation.mjs';",`import {PvpDiscardPresentationLedger} from '${pathToFileURL(resolve('server/discard-presentation.mjs')).href}';`)
 .replace(anchor,`  injectFixtureForF19(snapshot){this.#canonical=structuredClone(snapshot);this.#bridgeSeat=null;this.#bridgeRevision=-1;}\n${anchor}`);
const {Season0HeadlessAuthority:Authority}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source));
for (const seat of [1,2]){
 for (const decide of ['LEFT','SKIP']){
  const a=new Authority(root);
  a.start({player1DeckKey:'s0_starter_03_red_white',player2DeckKey:'s0_starter_01_blue_red'});
  a.completeOpening(1,'HEADS');
  const snapshot=a._canonicalForServerOnly(),s=snapshot.appState;
  const side=seat===1?'PLAYER':'AI',pfx=seat===1?'player':'ai';
  const before=Object.fromEntries(['LEFT','CENTER','RIGHT'].map(l=>[l,s[pfx+'Heroes'][l].instance_id]));
  assert(before.CENTER&&before.LEFT&&before.RIGHT);
  s.turn=side;s.phase='Battle';s.round=3;s.gameOver=false;s.responseWindow=null;
  s.pending={type:'optional_swap',decision_side:side,source_side:side,source_lane:'CENTER',target_lane:'LEFT',card_id:'S0-THF-024',
    swap_lane:'LEFT',swap_options:['LEFT'],commit_token:'qa-F19-'+seat+'-'+decide,next_pending:null};
  a.injectFixtureForF19(snapshot);
  const rev=a.revision;
  const ownerView=viewerSafeBoard(a._viewForMaskingOnly(seat),{seat,revision:rev,secret:Buffer.alloc(32)});
  assertViewerSafeBoard(ownerView);
  assert.equal(ownerView.appState.pending.type,'optional_swap');
  const result=a.applyIntent(seat,'performOptionalSwapDecision',[decide==='SKIP'?false:'LEFT']);
  assert.equal(result.ok,true);assert.equal(a.revision,rev+1);
  const final=a._canonicalForServerOnly().appState;
  assert.equal(final.pending,null,'optional card-effect Swap must end its choice');
  assert.equal(final[pfx+'Heroes'].CENTER.instance_id,decide==='SKIP'?before.CENTER:before.LEFT);
  assert.equal(final[pfx+'Heroes'].LEFT.instance_id,decide==='SKIP'?before.LEFT:before.CENTER);
  for(const viewerSeat of [1,2]){
    const view=viewerSafeBoard(a._viewForMaskingOnly(viewerSeat),{seat:viewerSeat,revision:a.revision,secret:Buffer.alloc(32)});
    assertViewerSafeBoard(view);assert.equal(view.appState.pending,null);
    assert(view.appState.aiHand.every(x=>x==='__HIDDEN_CARD_BACK__'));
  }
  console.log('PASS F19 optional Swap authoritative',decide,'Seat',seat,'revision',a.revision);
 }
}
// An optional opponent target Swap is public as a board change, but its extra toast is
// recipient-only. Confirm the mirror/projection does not leak the notice.
{
 const a=new Authority(root);a.start({player1DeckKey:'s0_starter_03_red_white',player2DeckKey:'s0_starter_01_blue_red'});
 a.completeOpening(1,'HEADS');const raw=a._canonicalForServerOnly();
 raw.appState.cardSwapNotices=[{sequence:1,side:'PLAYER',kind:'completed',card_id:'S0-ARC-016',from_lane:'CENTER',to_lane:'RIGHT'}];
 a.injectFixtureForF19(raw);
 const owner=viewerSafeBoard(a._viewForMaskingOnly(1),{seat:1,revision:a.revision,secret:Buffer.alloc(32)});
 const opponent=viewerSafeBoard(a._viewForMaskingOnly(2),{seat:2,revision:a.revision,secret:Buffer.alloc(32)});
 assertViewerSafeBoard(owner);assertViewerSafeBoard(opponent);
 assert.equal(owner.appState.cardSwapNotices.length,1,'victim must see their Swap result');
 assert.equal(opponent.appState.cardSwapNotices.length,0,'attacker must not get opponent-only Swap notice');
}
console.log('PASS F19 recipient-only optional target Swap notification respects both seat projections');
console.log('PASS F19 optional choices release pending for both seats, snapshot remains private');
