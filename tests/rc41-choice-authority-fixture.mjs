import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {viewerSafeBoard,assertViewerSafeBoard} from '../server/viewer-safe.mjs';
const root=join(process.cwd(),'public/battle');
const src=readFileSync(resolve('server/headless-rc32.mjs'),'utf8');
const anchor='  /** A verified seat may concede without turn/response ownership. */';
assert.ok(src.includes(anchor));
const source=src
 .replace("import {PvpCombatPresentationLedger} from './combat-presentation.mjs';",`import {PvpCombatPresentationLedger} from '${pathToFileURL(resolve('server/combat-presentation.mjs')).href}';`)
 .replace("import {PvpDiscardPresentationLedger} from './discard-presentation.mjs';",`import {PvpDiscardPresentationLedger} from '${pathToFileURL(resolve('server/discard-presentation.mjs')).href}';`)
 .replace("import {isCompletedOpponentManaContinuation} from './commit-semantics.mjs';",
   `import {isCompletedOpponentManaContinuation} from '${pathToFileURL(resolve('server/commit-semantics.mjs')).href}';`)
 .replace(anchor,`  injectFixtureForChoiceQA(snapshot){this.#canonical=clone(snapshot);this.#bridgeSeat=null;this.#bridgeRevision=-1;}\n${anchor}`);
const {Season0HeadlessAuthority:Authority}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source));
for(const seat of [1,2]){
 const a=new Authority(root);
 a.start({player1DeckKey:'s0_starter_03_red_white',player2DeckKey:'s0_starter_01_blue_red'});
 a.completeOpening(1,'HEADS');
 const snap=a._canonicalForServerOnly(),s=snap.appState;
 const actorSide=seat===1?'PLAYER':'AI',pfx=seat===1?'player':'ai';
 s.turn=actorSide;s.phase='Deploy';s.responseWindow=null;s.gameOver=false;
 const original=s[pfx+'Deck'].slice();
 const cards=[0,1,2].map(i=>({card_id:original[i],deck_index:i}));
 assert.equal(cards.length,3);assert(cards.every(x=>x.card_id),'need physical card candidate');
 s.pending={type:'card_search_choice',side:actorSide,decision_side:actorSide,zone:'deck',source_card_id:'S0-CLE-029',
     resolve_to:'',commit_token:'fixture-tuneup-token',multi_select:true,max_count:2,required_count:2,
     selected_indices:[],selected_index:null,candidates:cards};
 a.injectFixtureForChoiceQA(snap);
 const view=viewerSafeBoard(a._viewForMaskingOnly(seat),{seat,revision:a.revision,secret:Buffer.alloc(32)});
 assertViewerSafeBoard(view);
 assert.equal(view.appState.playerDeck[0],'__HIDDEN_CARD_BACK__','own deck is masked on network');
 assert.equal(view.appState.pending.candidates[0].card_id,original[0],'only expressly searchable candidate visible');
 const beforeRevision=a.revision;
 const beforeInvalid=JSON.stringify(a._canonicalForServerOnly().appState);
 for(const invalid of [
   {indices:[0,2],token:'expired-token',zone:'deck',source:'S0-CLE-029',resolveTo:''},
   {indices:[0,0],token:'fixture-tuneup-token',zone:'deck',source:'S0-CLE-029',resolveTo:''},
   {indices:[0,999],token:'fixture-tuneup-token',zone:'deck',source:'S0-CLE-029',resolveTo:''}
 ]){
   assert.throws(()=>a.applyIntent(seat,'commitExactCardSearchChoice',[invalid]));
   assert.equal(a.revision,beforeRevision,'invalid transaction must not advance revision');
   assert.equal(JSON.stringify(a._canonicalForServerOnly().appState),beforeInvalid,'invalid card selection must not mutate canonical state');
 }
 const result=a.applyIntent(seat,'commitExactCardSearchChoice',[{indices:[0,2],token:'fixture-tuneup-token',zone:'deck',source:'S0-CLE-029',resolveTo:''}]);
 assert.equal(result.ok,true);
 assert.ok(a.revision>beforeRevision);
 const after=a._canonicalForServerOnly().appState;
 assert.equal(after.pending,null,'physical deck search must finish, not strand selected card');
 assert.equal(after[pfx+'Deck'].length,original.length-2);
 assert.ok(after[pfx+'Hand'].includes(original[0]));
 assert.ok(after[pfx+'Hand'].includes(original[2]));
 console.log('PASS real authority masked search->atomic commit->finished for seat',seat,'revision',a.revision);
}
