import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {applyOptimizedPvpIntent,applyExactLocalChoiceDraft} from '../server/headless-rc32.mjs';

function browserHarness(pending){
  const outgoing=[],uiRender={count:0},engineCalls=[];
  const appState={pending,turn:'PLAYER',phase:'Deploy',playerDeck:Array.from({length:5},()=> 'HIDDEN'),aiDeck:['HIDDEN'],playerHand:['S0-CLE-001','S0-CLE-002'],responseWindow:null};
  const bridge={getSnapshot:()=>({appState}),applyServerIntent(name,args){engineCalls.push({name,args});
    const p=appState.pending;if(name==='selectCardSearchChoice' &&p?.zone==='deck')return {ok:false,error:'Deck physical slot is masked'};
    if(name==='selectLegacyCostChoice' && p?.type==='legacy_cost_selection'){
      p.selected_cost_indices=p.selected_cost_indices||[];
      const idx=args[0],i=p.selected_cost_indices.indexOf(idx);
      if(i>=0)p.selected_cost_indices.splice(i,1);else p.selected_cost_indices.push(idx);
      return {ok:true};
    }
    if(name==='selectOpponentHandChoice') {p.selected_index=args[0];return {ok:true};}
    if(name==='selectSaintPurifyChoice'||name==='selectStatusRemovalChoice') {p.selected_status_choice=args[0];return {ok:true};}
    return {ok:false,error:'Action not stubbed'};
  }};
  const doc={readyState:'loading',visibilityState:'visible',body:{appendChild(){}},_listeners:{},
    addEventListener(n,fn){this._listeners[n]=fn}, getElementById(){return null},
    createElement(){return {setAttribute(){},style:{},textContent:'',hidden:false}}};
  const window={GL_LOCAL_AI_BRIDGE:bridge,GL_GAME_ENGINE:{},GL_AUTHORITY_ADAPTER:{register(){},use(){}},
    GL_PVP_BUILD_META:{buildId:'gl-s0-pvp-stage3-rc42-r394-20261122-a'},
    GL_GAME_UI:{render(){uiRender.count++},renderLocalChoiceDraft(){uiRender.count++}},
    GL_APP_MODE:'PVP',parent:null,addEventListener(){},dispatchEvent(){}};
  window.parent=window;
  const ctx=vm.createContext({window,document:doc,location:{origin:'https://site.test',search:''},
    WebSocket:{OPEN:1},sessionStorage:{getItem(){return null}},localStorage:{getItem(){return null}},
    setTimeout,clearTimeout,setInterval(){},clearInterval,URLSearchParams,Date,Math,console,
    CustomEvent:class {constructor(t,o){this.type=t;this.detail=o.detail;}}});
  vm.runInContext(readFileSync(resolve('public/battle/runtime/pvp-network.js'),'utf8'),ctx,
    {filename:'pvp-network.js'});
  const net=window.GL_S0_PVP_NETWORK;
  net.state.status='started';net.state.role='player';net.state.connected=true;
  net.state.clientId='unitseat1';net.state.revision=11;
  net.state.snapshot={appState};
  net.state.ws={readyState:1,send(data){outgoing.push(JSON.parse(data));}};
  return {net,appState,engineCalls,uiRender,outgoing,window};
}
const tuneup={type:'card_search_choice',decision_side:'PLAYER',zone:'deck',source_card_id:'S0-CLE-029',
  resolve_to:'tune_up',commit_token:'token-a',multi_select:true,required_count:2,max_count:2,
  candidates:[{card_id:'S0-CLE-011',deck_index:0},{card_id:'S0-CLE-012',deck_index:1},{card_id:'S0-CLE-013',deck_index:2}],selected_indices:[]};
{
 const {net,appState,engineCalls,outgoing,window}=browserHarness(tuneup);
 assert.equal(appState.playerDeck[0],'HIDDEN','never unmask deck to make selection work');
 assert.equal(net.sendIntent('selectCardSearchChoice',[0]).ok,true,'first choice must be local and legal');
 assert.equal(net.sendIntent('selectCardSearchChoice',[2]).ok,true,'second choice cannot be lost while waiting for a server ACK');
 assert.deepEqual(Array.from(net.projectChoiceState(appState).pending.selected_indices),[0,2], 'UI sees the draft');
 assert.equal(engineCalls.length,0,'must not use client donor physical deck check (always fails on HIDDEN)');
 assert.equal(tuneup.selected_indices.length,0,'authoritative masked snapshot never mutates');
 assert.equal(net.sendIntent('handleChoiceConfirm',[]).ok,true);
 assert.equal(outgoing.length,1,'one server intent for multi-card selection');
 assert.equal(outgoing[0].intent,'commitExactCardSearchChoice');
 assert.deepEqual(Array.from(outgoing[0].args[0].indices),[0,2]);
 assert.equal(outgoing[0].args[0].token,'token-a');
 assert.equal(net.sendIntent('handleChoiceConfirm',[]).busy,true,'no second unacknowledged intent');
 console.log('PASS browser Tune Up deck search selects two HIDDEN-backed positions without RTT');
}
{
 const p={type:'card_search_choice',decision_side:'PLAYER',zone:'discard',source_card_id:'S0-MAG-002',
  commit_token:'token-b',resolve_to:'s0_condition_precommit',multi_select:false,
  candidates:[{card_id:'S0-WAR-001',discard_index:0},{card_id:'S0-CLE-001',discard_index:1}]};
 const {net,outgoing,appState}=browserHarness(p);
 assert.equal(net.sendIntent('selectCardSearchChoice',[1]).ok,true);
 assert.equal(net.projectChoiceState(appState).pending.selected_index,1);
 assert.equal(net.sendIntent('handleChoiceConfirm',[]).ok,true);
 assert.deepEqual(Array.from(outgoing[0].args[0].indices),[1]);
 console.log('PASS browser non-Tune Up card search uses same atomic path');
}
{
 const p={type:'legacy_cost_selection',decision_side:'PLAYER',side:'PLAYER',min_cost:1,required_cost:2,
  cost_candidates:[{card_id:'S0-CLE-001',hand_index:0},{card_id:'S0-CLE-002',hand_index:1}],selected_cost_indices:[]};
 const {net,outgoing}=browserHarness(p);
 assert.equal(net.sendIntent('selectLegacyCostChoice',[0]).ok,true);
 assert.equal(net.sendIntent('selectLegacyCostChoice',[1]).ok,true);
 assert.equal(net.sendIntent('handleChoiceConfirm',[]).ok,true);
 assert.equal(outgoing.length,1);
 assert.equal(outgoing[0].intent,'commitExactLocalChoiceDraft');
 assert.equal(outgoing[0].args[0].kind,'legacy_cost_selection');
 assert.deepEqual(Array.from(outgoing[0].args[0].selected),[0,1]);
 console.log('PASS browser Legacy cost two selections -> one authoritative transaction');
}
{
 const p={type:'opponent_hand_choice',decision_side:'PLAYER',candidates:[{card_id:'HIDDEN',hand_index:0},{card_id:'HIDDEN',hand_index:1}]};
 const {net,outgoing}=browserHarness(p);
 assert.equal(net.sendIntent('selectOpponentHandChoice',[1]).ok,true);
 assert.equal(net.sendIntent('commitOpponentHandChoice',[]).ok,true);
 assert.equal(outgoing[0].intent,'commitExactLocalChoiceDraft');
 assert.equal(outgoing[0].args[0].index,1);
 console.log('PASS browser blind opponent Hand selection -> single atomic intent');
}

function bridgeForSearch(p){
 const calls=[];
 let pending=structuredClone(p);
 const bridge={applyServerIntent(name,args){
   calls.push(name);
   if(name==='selectCardSearchChoice'){
     if(!pending||pending.type!=='card_search_choice')return {ok:false,error:'closed'};
     const idx=args[0],c=pending.candidates[idx];
     if(!c||pending.zone==='deck'&&pending.deck[c.deck_index]!==c.card_id)return {ok:false,error:'not real deck slot'};
     if(pending.multi_select){const list=pending.selected_indices||[],f=list.indexOf(idx);
       if(f>=0)list.splice(f,1);else list.push(idx);pending.selected_indices=list;}
     else pending.selected_index=idx;
     return {ok:true};
   }
   if(name==='handleChoiceConfirm'){
     if(!pending||pending.type!=='card_search_choice')return {ok:false};
     pending=null;return {ok:true};
   }
   return {ok:false,error:'unexpected action'};
 }};
 return {bridge,readPending:()=>pending,calls};
}
const pkt={indices:[0,2],token:'token-a',zone:'deck',source:'S0-CLE-029',resolveTo:'tune_up'};
{
 const pending={...tuneup,deck:['S0-CLE-011','S0-CLE-012','S0-CLE-013']};
 const f=bridgeForSearch(pending);
 assert.equal(applyOptimizedPvpIntent({bridge:f.bridge,readPending:f.readPending,name:'commitExactCardSearchChoice',args:[pkt]}).ok,true);
 assert.equal(f.readPending(),null);
 assert.deepEqual(f.calls,['selectCardSearchChoice','selectCardSearchChoice','handleChoiceConfirm']);
 console.log('PASS server validates and commits exact two positions on REAL deck');
}
{
 const f=bridgeForSearch({...tuneup,deck:['S0-CLE-011','S0-CLE-012','S0-CLE-013']});
 for(const invalid of [ {...pkt,token:'wrong'}, {...pkt,indices:[0,0]}, {...pkt,indices:[0]}, {...pkt,indices:[0,99]} ]){
  assert.throws(()=>applyOptimizedPvpIntent({bridge:f.bridge,readPending:f.readPending,name:'commitExactCardSearchChoice',args:[invalid]}));
 }
 assert.equal(f.calls.length,0,'invalid packets must not mutate gameplay');
 console.log('PASS server rejects stale, duplicate, wrong count, out-of-range search packets');
}
{
 const f=bridgeForSearch({...tuneup,deck:['S0-CLE-011','S0-CLE-012','CHANGED']});
 assert.throws(()=>applyOptimizedPvpIntent({bridge:f.bridge,readPending:f.readPending,name:'commitExactCardSearchChoice',args:[pkt]}));
 console.log('PASS server engine rejects card moved from physical deck slot');
}
{
 let p={type:'legacy_cost_selection',decision_side:'PLAYER',side:'PLAYER',required_cost:2,min_cost:1,
    cost_candidates:[{card_id:'S0-CLE-001',hand_index:0},{card_id:'S0-CLE-002',hand_index:1}],selected_cost_indices:[]};
 const bridge={applyServerIntent(name,args){
  if(name==='selectLegacyCostChoice'){
    const idx=args[0];if(idx<0||idx>1)return {ok:false};
    const i=p.selected_cost_indices.indexOf(idx);if(i>=0)p.selected_cost_indices.splice(i,1);else p.selected_cost_indices.push(idx);
    return {ok:true};
  }if(name==='handleChoiceConfirm'){p=null;return {ok:true};}return {ok:false};
 }};
 const result=applyExactLocalChoiceDraft({bridge,readPending:()=>p,payload:{kind:'legacy_cost_selection',selected:[0,1]}});
 assert.equal(result.ok,true);assert.equal(p,null);
 console.log('PASS server Legacy cost replay validates exact chosen positions and commits');
}
console.log('RESULT: targeted RC41 card-selection network tests passed');
