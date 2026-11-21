// Permanent regression for the exact old-return-value failure: a resolved
// Attack's final Mana Burn/Steal choice can return false from the donor
// continuation while STILL completing its rules and changing canonical state.
// Tested through the actual two-seat isolated PvP server authority.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {viewerSafeBoard,assertViewerSafeBoard,makeBlindChoices} from '../server/viewer-safe.mjs';

const root=join(process.cwd(),'public/battle');
const source=readFileSync('server/headless-rc32.mjs','utf8');
const marker='  /** A verified seat may concede without turn/response ownership. */';
assert(source.includes(marker),'QA fixture injection hook moved: review the authority contract');
const mod=source
 .replace("import {PvpCombatPresentationLedger} from './combat-presentation.mjs';",`import {PvpCombatPresentationLedger} from '${pathToFileURL(resolve('server/combat-presentation.mjs')).href}';`)
 .replace("import {PvpDiscardPresentationLedger} from './discard-presentation.mjs';",`import {PvpDiscardPresentationLedger} from '${pathToFileURL(resolve('server/discard-presentation.mjs')).href}';`)
 .replace(marker,`  injectManaFixture(snapshot){this.#canonical=structuredClone(snapshot);this.#bridgeSeat=null;this.#bridgeRevision=-1;}\n${marker}`);
const {Season0HeadlessAuthority:Authority}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(mod));

const SECRET=Buffer.alloc(32,47);
let passes=0;
for(const seat of [1,2])for(const mode of ['REMOVE_ONLY','REMOVE_AND_GAIN_OWN']){
 const a=new Authority(root);
 a.start({player1DeckKey:'s0_starter_03_red_white',player2DeckKey:'s0_starter_01_blue_red'});
 a.completeOpening(1,'HEADS');
 const initial=a._canonicalForServerOnly();const s=initial.appState;
 const actor=seat===1?'PLAYER':'AI',opponent=seat===1?'AI':'PLAYER';
 s.turn=actor;s.phase='Battle';s.round=3;s.gameOver=false;s.pending=null;s.responseWindow=null;
 s.pvpHumanVsHuman=true;s.autoEndTurnPending=false;s.autoEndResumeScheduled=false;
 const oppPool=s[opponent==='AI'?'aiManaPoolCards':'playerManaPoolCards'];
 assert(oppPool.length>=2,'both starting pools must contain at least 2 Mana');
 const effect='S0-ARC-001';
 s.pending={type:'opponent_mana_selection',side:actor,decision_side:actor,target_side:opponent,
  mode,reason:'Regression QA Mana '+mode,required_count:1,
  candidates:oppPool.map(sh=>({uid:sh.uid})),selected_indices:[],commit_stage:'committed',
  continuation:{action:{card_id:effect,source_side:actor,source_lane:'CENTER',target_side:opponent,target_lane:'CENTER'},post:{},result:{mana_interactions:[]},options:{},resume_pending:null}};
 a.injectManaFixture(initial);
 const revision=a.revision;
 const local=a._viewForMaskingOnly(seat).appState;
 assert.equal(local.pending?.decision_side,'PLAYER');
 assert.equal(local.pending?.target_side,'AI');
 const tokens=makeBlindChoices(local,revision,SECRET,seat);
 const safe=viewerSafeBoard({appState:local},{seat,revision,secret:SECRET});
 assertViewerSafeBoard(safe);
 assert(safe.appState.pending.candidates.every(x=>/^[0-9a-f]{32}$/.test(x.choice_handle)));
 assert(safe.appState.pending.candidates.every(x=>!oppPool.some(y=>y.uid===x.choice_handle)), 'blind card UID leaked');
 const chosenHandle=[...tokens.keys()][0];const physicalIndex=tokens.get(chosenHandle);
 const selectedUid=local.pending.candidates[physicalIndex].uid;
 const ownerPoolKey=opponent==='AI'?'aiManaPoolCards':'playerManaPoolCards';
 const ownerDeckKey=opponent==='AI'?'aiManaDeck':'playerManaDeck';
 const poolBefore=s[ownerPoolKey].map(sh=>sh.uid),deckBefore=s[ownerDeckKey].map(sh=>sh.uid);
 const gainPoolKey=actor==='AI'?'aiManaPoolCards':'playerManaPoolCards';
 const gainBefore=s[gainPoolKey].length;
 assert(poolBefore.includes(selectedUid));
 const original=JSON.stringify(a._canonicalForServerOnly().appState);
 for(const forged of [[physicalIndex,physicalIndex],[999]]) {
  assert.throws(()=>a.applyIntent(seat,'commitExactOpponentManaSelectionIndices',[forged]));
  assert.equal(a.revision,revision,'illegal commit changed revision');
  assert.equal(JSON.stringify(a._canonicalForServerOnly().appState),original,'illegal commit changed board');
 }
 const result=a.applyIntent(seat,'commitExactOpponentManaSelectionIndices',[[physicalIndex]]);
 assert.equal(result.ok,true);
 assert.equal(a.revision,revision+1,'one successful user confirm must be one revision');
 const after=a._canonicalForServerOnly().appState;
 assert.equal(after.pending,null,'terminal attack continuation must close');
 assert.equal(after[ownerPoolKey].length,poolBefore.length-1);
 assert(!after[ownerPoolKey].some(sh=>sh.uid===selectedUid),'selected UID remains in opponent pool');
 assert.equal(after[ownerDeckKey].length,deckBefore.length+1);
 assert(after[ownerDeckKey].some(sh=>sh.uid===selectedUid),'selected shard did not return to owner deck');
 if(mode==='REMOVE_AND_GAIN_OWN')assert(after[gainPoolKey].length>=gainBefore,'Mana Steal illegally removed own Mana');
 for(const viewer of [1,2]){
  const v=viewerSafeBoard(a._viewForMaskingOnly(viewer),{seat:viewer,revision:a.revision,secret:SECRET});
  assertViewerSafeBoard(v);
  assert(v.appState.aiHand.every(x=>x==='__HIDDEN_CARD_BACK__'));
 }
 assert.throws(()=>a.applyIntent(seat,'commitExactOpponentManaSelectionIndices',[[physicalIndex]]),'repeat commit accepted');
 assert.equal(a.revision,revision+1,'duplicate confirm must not advance revision');
 passes++;
 console.log('PASS terminal Attack '+mode+' -> blind Mana CONFIRM Seat '+seat+' -> 1 commit');
}

// Chained Attack resolutions must open the next human choice, not auto-pick it.
// Each selection consumes one action and one revision. An old revision's
// handle is invalid for the next pending decision.
for(const seat of [1,2]){
 const a=new Authority(root);a.start({player1DeckKey:'s0_starter_03_red_white',player2DeckKey:'s0_starter_01_blue_red'});a.completeOpening(1,'HEADS');
 const snapshot=a._canonicalForServerOnly(),s=snapshot.appState;
 const side=seat===1?'PLAYER':'AI',other=seat===1?'AI':'PLAYER';
 s.turn=side;s.phase='Battle';s.round=3;s.gameOver=false;s.responseWindow=null;s.pvpHumanVsHuman=true;
 const pool=s[other==='AI'?'aiManaPoolCards':'playerManaPoolCards'];
 s.pending={type:'opponent_mana_selection',side,decision_side:side,target_side:other,mode:'REMOVE_ONLY',reason:'first Attack effect',required_count:1,
   candidates:pool.map(x=>({uid:x.uid})),selected_indices:[],commit_stage:'committed',
   continuation:{action:{card_id:'S0-ARC-001',source_side:side,source_lane:'CENTER',target_side:other,target_lane:'CENTER'},post:{},
     result:{mana_interactions:[{amount:1,mode:'REMOVE_ONLY',reason:'second Attack effect'}]},options:{},resume_pending:null}};
 a.injectManaFixture(snapshot);
 let view=a._viewForMaskingOnly(seat).appState;
 const firstMap=makeBlindChoices(view,a.revision,SECRET,seat),firstHandle=firstMap.keys().next().value;
 a.applyIntent(seat,'commitExactOpponentManaSelectionIndices',[[firstMap.get(firstHandle)]]);
 let after=a._canonicalForServerOnly().appState;
 assert.equal(after.pending?.type,'opponent_mana_selection','next required decision must open');
 assert.equal(after.pending.selected_indices.length,0,'next choice must start unselected');
 const firstRevision=a.revision;
 view=a._viewForMaskingOnly(seat).appState;
 const nextMap=makeBlindChoices(view,firstRevision,SECRET,seat);
 assert(!nextMap.has(firstHandle),'prior revision blind handle must expire');
 const nextIndex=nextMap.values().next().value;
 a.applyIntent(seat,'commitExactOpponentManaSelectionIndices',[[nextIndex]]);
 after=a._canonicalForServerOnly().appState;
 assert.equal(after.pending,null,'both Attack Mana decisions must finish');
 assert.equal(a.revision,firstRevision+1,'second choice advances once');
 console.log('PASS chained Attack -> two independent blind Mana decisions Seat '+seat);
 passes++;
}
console.log('PASS STAGE1 Mana continuation regression:',passes,'both-seat cases');
