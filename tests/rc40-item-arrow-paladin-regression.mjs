/**
 * RC40 PvP two-seat Item target arrows + own Paladin/Crusader ability notices.
 * Run from the PvP-Trial repository root:
 *   node tests/rc40-item-arrow-paladin-regression.mjs
 * Read-only regression: uses only public viewer-safe board and extracted real UI logic.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {viewerSafeBoard, assertViewerSafeBoard} from '../server/viewer-safe.mjs';

const runtime=readFileSync(new URL('../public/battle/shared-app/app-runtime.js',import.meta.url),'utf8');
function extract(start,end){
  const a=runtime.indexOf(start), b=runtime.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,`Missing UI function extraction: ${start}`);
  return runtime.slice(a,b);
}
function viewer(responseWindow=null,presentationEvents=[],seat=1){
  const st={
    playerHand:['S0-ITM-001'],aiHand:['S0-ITM-002'],playerDeck:[],aiDeck:[],playerLegacy:[],aiLegacy:[],
    playerManaPoolCards:[],aiManaPoolCards:[],playerManaDeck:[],aiManaDeck:[],presentationEvents,
    pending:responseWindow?{type:'response_window',decision_side:responseWindow.response_owner}:null,
    responseWindow,
  };
  const safe=viewerSafeBoard({appState:st},{seat,revision:6,secret:Buffer.alloc(32,11)});
  assertViewerSafeBoard(safe);
  return safe.appState;
}
function itemWindow({responseOwner,sourceSide,actualTargetSide,actualLane='RIGHT',responseSide}){
  return {
    kind:'incoming_card',response_owner:responseOwner,source_side:sourceSide,
    target_side:responseSide,target_lane:actualLane,
    card_id:'S0-ITM-001',
    // Deliberately different: response target identifies the responder,
    // while action.target_side is the real effect recipient.
    action:{card_id:'S0-ITM-001',side:sourceSide,target_side:actualTargetSide,target_lane:actualLane,
      hand_index:2,commit_token:'CANONICAL_HIDDEN_TOKEN',private_engine_only:'SECRET'}
  };
}
const actor=viewer(itemWindow({responseOwner:'AI',sourceSide:'PLAYER',actualTargetSide:'PLAYER',responseSide:'AI'}));
const peer=viewer(itemWindow({responseOwner:'PLAYER',sourceSide:'AI',actualTargetSide:'AI',responseSide:'PLAYER'}),[],2);
assert.equal(actor.responseWindow.action,undefined,'Non-response player must NOT get canonical action');
assert.equal(actor.responseWindow.public_card_target.target_side,'PLAYER','Actor views own Item on own Hero');
assert.equal(peer.responseWindow.public_card_target.target_side,'AI','Peer sees same Item target as their opponent Hero');
assert.equal(actor.responseWindow.public_card_target.target_lane,'RIGHT');
assert.equal(peer.responseWindow.public_card_target.target_lane,'RIGHT');
assert.ok(!JSON.stringify(actor.responseWindow).includes('CANONICAL_HIDDEN_TOKEN'));
assert.ok(!JSON.stringify(actor.responseWindow).includes('private_engine_only'));
assert.ok(!JSON.stringify(actor.responseWindow).includes('hand_index'));
// Enemy-targeted Item must retain enemy target; no blanket actor->self flip.
const enemy=viewer(itemWindow({responseOwner:'AI',sourceSide:'PLAYER',actualTargetSide:'AI',actualLane:'LEFT',responseSide:'AI'}));
assert.equal(enemy.responseWindow.public_card_target.target_side,'AI');
assert.equal(enemy.responseWindow.public_card_target.target_lane,'LEFT');
const emptyTarget=viewer(itemWindow({responseOwner:'AI',sourceSide:'PLAYER',actualTargetSide:null,actualLane:null,responseSide:'AI'}));
assert.equal(emptyTarget.responseWindow.public_card_target.target_side,null);
assert.equal(emptyTarget.responseWindow.public_card_target.target_lane,null);

// Execute the real browser routing function in a DOM-free VM. The early-return
// Item branch is the target; unrelated attack/response branches are inert.
const ctx={
  rawCardDef:id=>({family:'item'}),cv:id=>({family:'item',name:id==='S0-ITM-001'?'Health Potion':'Test Item'}),
  isDefenseResponseArrowCard:()=>false,
  findActiveAttackWindow:()=>null,
  pendingActionInfo:()=>null,
  resolveActionSourceLane:(s,a)=>a,
  latestResolvedActionThisPhase:()=>null,
  protectedHeroFromResponse:()=>null,
  transientDefenseConnector:null,
  uiResponseSourceChoice:null,
  transientConnectorKey:'',transientConnectorUntil:0,
  performance:{now:()=>0},
  window:{GL_APP_MODE:'PVP'},
  Array,Number,String,Map,Set,Math,
};
vm.createContext(ctx);
const normalizeLine=runtime.match(/^function normalizeAction\(a,id\)\{[^\n]*\}$/m)?.[0];
assert.ok(normalizeLine,'Missing real normalizeAction()');
vm.runInContext(normalizeLine,ctx);
vm.runInContext(extract('function itemEventArrowContexts(a){','function targetElementForContext(ctx){'),ctx);
vm.runInContext(extract('function activeTargetContexts(s,chain){','function renderAttackLine(s,chain){'),ctx);
const contexts=state=>JSON.parse(JSON.stringify(ctx.activeTargetContexts({...state,pending:null},[])));
for(const [state,side,lane,title] of [
  [actor,'PLAYER','RIGHT','Actor local own Hero'],
  [peer,'AI','RIGHT','Peer sees actor Hero as opponent'],
  [enemy,'AI','LEFT','Item targets actual enemy LEFT']
]){
  const arcs=contexts(state);
  assert.equal(arcs.length,1,title+' arrow count');
  assert.equal(arcs[0].source_kind,'active-card',title+' starts at Active Card');
  assert.equal(arcs[0].target_kind,'hero',title+' targets Hero');
  assert.equal(arcs[0].target_side,side,title+' side');
  assert.equal(arcs[0].target_lane,lane,title+' lane');
}
assert.equal(contexts(emptyTarget).length,0,'No declared Hero target must not invent enemy arrow');

const ownSpend={
  id:'MANA-LOSS-PALADIN',type:'MANA_LOSS_COMMITTED',side:'PLAYER',source_side:'PLAYER',
  loss_kind:'ABILITY_SPEND',effect_name:'Holy Resurgence',removed_count:1,
  removed_shards:[{kind:'MANA',class_name:''}],
};
const self=viewer(null,[ownSpend]);
assert.equal(self.presentationEvents.length,1,'Paladin owner receives resolved Mana cost');
assert.equal(self.presentationEvents[0].loss_kind,'ABILITY_SPEND');
const other=viewer(null,[{...ownSpend,side:'AI',source_side:'AI'}],2);
assert.equal(other.presentationEvents.length,0,'Opposing player NEVER receives Paladin own cost');
const fakeOpponentSelf={...ownSpend,side:'PLAYER',source_side:'AI'};
assert.equal(viewer(null,[fakeOpponentSelf]).presentationEvents.length,0,'Opponent Class Ability cost must not be misreported as attack');
const enemyLoss={...ownSpend,id:'MANA-LOSS-BURN',source_side:'AI',loss_kind:'OPPONENT_REMOVE',effect_name:'Mana Burn'};
assert.equal(viewer(null,[enemyLoss]).presentationEvents.length,1,'Existing opponent Mana Burn notification preserved');
const crusader=viewer(null,[{...ownSpend,id:'MANA-LOSS-CRUSADER',effect_name:'Radiant Oblivion'}]);
assert.equal(crusader.presentationEvents.length,1,'Crusader uses same own Class Ability notice');

const notices=[];
const nctx={
  window:{GL_APP_MODE:'PVP'},cv:()=>null,st:()=>({pvpActionEventsBySide:{AI:[]}}),
  queuePresentationNotice:(...a)=>notices.push(a),pvpNoticeMs:x=>x,
  Array,Map,Math,Number,String,
};
vm.createContext(nctx);
vm.runInContext(extract('function describeResolvedManaShards(shards){','function presentPvpManaLossAfterReveal(event){'),nctx);
nctx.presentPvpManaLossNotice(self.presentationEvents[0]);
assert.equal(notices.length,1,'Paladin Mana notice emitted');
assert.equal(notices[0][1],'You used Holy Resurgence.');
assert.match(notices[0][2],/Spent 1 Regular Mana Shard\./);
nctx.presentPvpManaLossNotice(crusader.presentationEvents[0]);
assert.match(notices[1][1],/Radiant Oblivion/);
nctx.presentPvpManaLossNotice(viewer(null,[enemyLoss]).presentationEvents[0]);
assert.match(notices[2][1],/Opponent used Mana Burn/);

const reveal=extract('function presentPvpManaLossAfterReveal(event){','// RC39 PvP public action ledger');
assert.match(reveal,/event\.source_side==='PLAYER'&&event\.loss_kind==='ABILITY_SPEND'/);
assert.match(reveal,/setTimeout\(show,180\)/);
console.log('PASS RC40 PvP Item Arrow: both seat perspectives, real Hero target, no private action leak');
console.log('PASS RC40 Paladin/Crusader: self-paid notice, correct text, no opponent leak, Mana Burn preserved');
