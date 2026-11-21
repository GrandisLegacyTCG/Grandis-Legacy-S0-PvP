'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'../public/battle');
const cx={console,URL,Date,Math,Array,JSON,Map,Set,Promise,Uint8Array,TextDecoder,TextEncoder,
  performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
  requestAnimationFrame:()=>0,cancelAnimationFrame(){},crypto:require('crypto').webcrypto};
cx.window=cx;cx.globalThis=cx;cx.location={href:'http://example.test/battle/',origin:'http://example.test'};
cx.navigator={userAgent:'Stage2 casting adapter QA'};
cx.document={readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null},querySelectorAll(){return []},createElement(){return{style:{},appendChild(){},setAttribute(){}}},documentElement:{classList:{toggle(){}}},body:{appendChild(){}}};
vm.createContext(cx);
for(const file of ['engine/js/static-data.js','engine/js/runtime-authority.js','engine/shared-app/active-starters.js',
 'runtime/season0-generated/rc41-approved-print-overrides.js','runtime/season0-generated/rc42-main-deck-r394-overlay.js','engine/shared-app/app.bundle.js']){
 let src=fs.readFileSync(path.join(root,file),'utf8');
 if(file.endsWith('app.bundle.js')){
  assert.match(src,/\n\}\)\(\);\s*$/);
  src=src.replace(/\n\}\)\(\);\s*$/, '\nwindow.__STAGE2_CASTING={initCards,card,heroState,buildInitialMatchState,legalTargetLanesFor,validateAction,gainMana,commitPlayedCard,commitManaShardPaymentChoice,resolvePendingCastingsFor,isCastingCard,getLegalActions,get state(){return appState},setState(s){appState=s;matchStarted=true;SUPPRESS_RENDER=true}};\n})();');
 }
 vm.runInContext(src,cx,{filename:file,timeout:60000});
}
const q=cx.__STAGE2_CASTING;q.initCards();
let count=0;
function test(name,run){run();count++;console.log('PASS '+name)}
function fresh(side){
 const s=q.buildInitialMatchState();q.setState(s);s.preGame=null;s.turn=side;s.phase='Battle';s.round=2;
 s.playerHand=[];s.aiHand=[];s.pending=null;s.responseWindow=null;s.gameOver=false;s.mana=30;s.aiMana=30;q.gainMana(s,'PLAYER',8);q.gainMana(s,'AI',8);
 const heroes=side==='PLAYER'?s.playerHeroes:s.aiHeroes,enemy=side==='PLAYER'?s.aiHeroes:s.playerHeroes;
 const caster=heroes.CENTER;caster.card_id='S0-MAG-H001';caster.hp=100;caster.maxHp=100;
 caster.exhausted=false;caster.statuses=[];caster.attachments=[null,null];
 const target=enemy.LEFT;target.hp=0;target.legacy_mode=true;target.active_legacy_card_id='S0-CLE-L001';
 (side==='PLAYER'?s.playerHand:s.aiHand).push('S0-MAG-020');
 return s;
}
test('casting is the donor position-lock card',()=>assert.equal(q.isCastingCard(q.card('S0-MAG-020')),true));
for(const side of ['PLAYER','AI']){
 test(side+' may lock opposing Legacy position (normal Attack still cannot)',()=>{
  const s=fresh(side),other=side==='PLAYER'?'AI':'PLAYER';
  const cast=q.legalTargetLanesFor(s,side,'S0-MAG-020','CENTER');
  assert.ok(cast.includes('LEFT'),JSON.stringify(cast));
  const ordinary=q.legalTargetLanesFor(s,side,'S0-MAG-005','CENTER');
  assert.ok(!ordinary.includes('LEFT'),'Non-Casting Attack targeted Legacy');
  const action={type:'PLAY_CARD',card_id:'S0-MAG-020',source_side:side,source_lane:'CENTER',target_side:other,target_lane:'LEFT'};
  const validation=q.validateAction(s,side,action);
  assert.equal(validation.ok,true,'Casting declaration rejected at Legacy position '+JSON.stringify(validation));
 });
}
test('casting position-lock remains within source AoA',()=>{
 const s=fresh('PLAYER');for(const lane of ['LEFT','RIGHT']){
  const h=s.playerHeroes[lane];h.card_id='S0-MAG-H001';h.hp=100;
  const legal=q.legalTargetLanesFor(s,'PLAYER','S0-MAG-020',lane);
  assert.ok(!legal.includes(lane==='LEFT'?'RIGHT':'LEFT'),'Casting illegally extended AoA');
 }
});
test('casting release onto Legacy deals no damage and creates no response',()=>{
 const s=fresh('PLAYER');q.setState(s);
 const result=q.commitPlayedCard(s,{type:'PLAY_CARD',card_id:'S0-MAG-020',hand_index:0,source_side:'PLAYER',source_lane:'CENTER',target_side:'AI',target_lane:'LEFT'});
 assert.ok(result,'Could not declare Casting');
 if(s.pending?.type==='mana_shard_payment_choice')assert.ok(q.commitManaShardPaymentChoice());
 assert.ok(s.pendingCastings?.length,'Casting not queued');
 s.pendingCastings[0].counters=s.pendingCastings[0].required_counters||1;
 q.resolvePendingCastingsFor(s,'PLAYER');
 assert.equal(s.pendingCastings.length,0);
 assert.ok(!s.responseWindow,'Legacy target improperly received a Response');
});
console.log('STAGE 2 CASTING '+count+'/'+count+' PASS');
