#!/usr/bin/env node
'use strict';
// Real RC41 F19 engine scenarios executed against the multiplayer bundle.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../public/battle');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
let count=0;
function check(name,fn){try{fn();count++;console.log('PASS',name)}catch(e){process.exitCode=1;console.error('FAIL',name,String(e.stack||e).slice(0,1700))}}
const ui=read('shared-app/app-runtime.js'),engine=read('engine/shared-app/app.bundle.js'),css=read('shared-ui/battlefield-ui.css');
check('F18 one owner of scroll, pending key preserves scroll across WS snapshots',()=>{
 assert(ui.includes('const sameSearch=handSearch&&pendingKey&&pendingKey===glHandSearchPendingKey;'));
 assert(ui.includes('grid.scrollTop=scrollBefore;'));
 assert(css.includes('overflow-y:hidden!important;overflow-x:hidden!important;'));
});
check('F19 mandatory target Swap auto without popup and optional menu with SKIP',()=>{
 assert(engine.includes('var opts=soulBlastTargetSwapOptions(state,action); if(!opts.length)return false'));
 assert(ui.includes("const p=s.pending,allowed=['card_search_choice','legacy_card_choice','crystal_ball_reorder','optional_swap']"));
 assert(ui.includes("skip.textContent='SKIP';skip.disabled=false"));
 assert(css.includes('.gl-vsai-choice-overlay.gl-choice-swap .gl-swap-choice-button'));
});
const ctx={console,URL,Date,Math,Array,JSON,Map,Set,Promise,Uint8Array,TextDecoder,TextEncoder,
 performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},requestAnimationFrame:()=>0,cancelAnimationFrame(){},crypto:crypto.webcrypto};
ctx.window=ctx;ctx.globalThis=ctx;ctx.location={href:'http://local.test/index.html',origin:'http://local.test'};ctx.navigator={userAgent:'RC41 F18/F19 QA'};
ctx.document={readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null},querySelectorAll(){return []},createElement(){return {style:{},appendChild(){},setAttribute(){}}},documentElement:{classList:{toggle(){}}},body:{appendChild(){}}};
vm.createContext(ctx);
for(const file of ['engine/js/static-data.js','assets/review-db158/js/db166-view-model.js','engine/js/runtime-authority.js','engine/shared-app/active-starters.js','runtime/season0-generated/rc41-approved-print-overrides.js','engine/shared-app/app.bundle.js']){
 let code=read(file);
 if(file.endsWith('app.bundle.js'))code=code.replace(/\n\}\)\(\);\s*$/, `\nwindow.__AUD={initCards,card,heroState,buildInitialMatchState,resolvePostAttackChoices,sourceSwapOptions,soulBlastTargetSwapOptions,performOptionalSwapDecision,\n   get state(){return appState},setState(s){appState=s;matchStarted=true;SUPPRESS_RENDER=true;}};\n})();`);
 vm.runInContext(code,ctx,{filename:file,timeout:45000});
}
const api=ctx.__AUD;assert(api,'Engine harness injection failed');api.initCards();
const lanes=['LEFT','CENTER','RIGHT'];
function state(){
 const s=api.buildInitialMatchState();s.pvpHumanVsHuman=true;s.preGame=null;s.openingFlowCompleted=true;s.gameOver=false;s.turn='PLAYER';s.phase='Battle';s.round=3;s.pending=null;s.responseWindow=null;s.pvpHumanVsHuman=false;
 for(const side of ['PLAYER','AI'])for(const lane of lanes){
  const h=api.heroState(side==='PLAYER'?'S0-THF-H001':'S0-WAR-H001',side,lane);
  h.hp=Math.max(90,h.hp);h.statuses=[];h.exhausted=false;
  (side==='PLAYER'?s.playerHeroes:s.aiHeroes)[lane]=h;
 }
 api.setState(s);return s;
}
const soul=(sourceSide='AI',targetSide='PLAYER',targetLane='CENTER')=>({card_id:'S0-ARC-016',source_side:sourceSide,source_lane:'CENTER',target_side:targetSide,target_lane:targetLane});
const flash=()=>({card_id:'S0-THF-024',source_side:'PLAYER',source_lane:'CENTER',target_side:'AI',target_lane:'CENTER'});
const resolve=(s,a,post={})=>api.resolvePostAttackChoices(s,a,post,{connected:true,hp_damage:20,damage:20});
check('F19 mandatory Soul Blast automatically swaps a PLAYER Hero with no pending choice',()=>{
 const s=state(),id=s.playerHeroes.CENTER.instance_id;
 resolve(s,soul());
 const dest=lanes.find(l=>l!=='CENTER'&&s.playerHeroes[l].instance_id===id);
 assert(['LEFT','RIGHT'].includes(dest));assert.equal(s.pending,null);
 const notice=s.cardSwapNotices.at(-1);assert.equal(notice.kind,'completed');assert.equal(notice.side,'PLAYER');assert.equal(notice.from_lane,'CENTER');assert.equal(notice.to_lane,dest);assert.equal(notice.card_id,'S0-ARC-016');
});
check('F19 mandatory Soul Blast targets its victim, never reports completion to attacker',()=>{
 const s=state();resolve(s,soul('PLAYER','AI'));
 assert.equal(s.pending,null);assert.equal(s.cardSwapNotices.at(-1).side,'AI');
 assert.equal(s.cardSwapNotices.filter(x=>x.side==='PLAYER').length,0);
});
check('F19 mandatory chooses only available legal adjacent Hero when other is Frozen',()=>{
 const s=state(),id=s.playerHeroes.CENTER.instance_id;
 s.playerHeroes.LEFT.statuses=[{name:'Freeze',duration:2}];
 resolve(s,soul());
 assert.equal(s.playerHeroes.RIGHT.instance_id,id);
 assert.equal(s.cardSwapNotices.at(-1).to_lane,'RIGHT');assert.equal(s.pending,null);
});
check('F19 mandatory Frozen victim cancels immediately with reason (no popup)',()=>{
 const s=state();s.playerHeroes.CENTER.statuses=[{name:'Freeze',duration:2}];
 resolve(s,soul());
 assert.equal(s.pending,null);assert.equal(s.cardSwapNotices.at(-1).kind,'canceled');assert.match(s.cardSwapNotices.at(-1).reason,/Your Hero is Frozen/);
});
check('F19 mandatory Stunned victim cancels immediately with reason',()=>{
 const s=state();s.playerHeroes.CENTER.statuses=[{name:'Stun',duration:2}];
 resolve(s,soul());
 assert.equal(s.pending,null);assert.equal(s.cardSwapNotices.at(-1).kind,'canceled');assert.match(s.cardSwapNotices.at(-1).reason,/Your Hero is Stunned/);
});
check('F19 optional Swap still provides choices without auto-swapping',()=>{
 const s=state(),id=s.playerHeroes.CENTER.instance_id;
 assert.equal(resolve(s,flash(),{optional_swap_after:true}),true);
 assert.equal(s.pending.type,'optional_swap');assert.deepEqual(Array.from(s.pending.swap_options),['LEFT','RIGHT']);assert.equal(s.playerHeroes.CENTER.instance_id,id);
});
check('F19 optional SKIP always works without changing positions',()=>{
 const s=state(),before=lanes.map(l=>s.playerHeroes[l].instance_id);
 resolve(s,flash(),{optional_swap_after:true});api.performOptionalSwapDecision(false);
 assert.equal(s.pending,null);assert.deepEqual(lanes.map(l=>s.playerHeroes[l].instance_id),before);
});
check('F19 optional correctly validates and performs requested destination',()=>{
 const s=state(),id=s.playerHeroes.CENTER.instance_id;
 resolve(s,flash(),{optional_swap_after:true});api.performOptionalSwapDecision('LEFT');
 assert.equal(s.pending,null);assert.equal(s.playerHeroes.LEFT.instance_id,id);
});
check('Card Played donor formatter shows public Search/Return result artwork',()=>{
 const formatter=ctx.GL_GAME_ENGINE.getPublicCardPlayedDetail;
 assert.equal(typeof formatter,'function');
 const journal=[{id:'pvp_PLAYER_source_demo',side:'PLAYER',source_side:'PLAYER',card_id:'S0-ITM-018',
   played_event_order:19,label:'ITEM',title:'Magic Compass',resolution_state:'RESOLVED',
   card_movements:[{from:'Main Deck',to:'Hand',count:1,known:true,card_ids:['S0-WAR-001']}]}];
 const detail=formatter('PLAYER',journal[0].id,journal);
 assert(detail?.html);
 assert(detail.html.includes('Card Added to Hand (Search / Return)'));
 assert(detail.html.includes('played-public-pickup'));
 assert(detail.html.includes('S0-WAR-001'));
 const concealed=[{...journal[0],id:'pvp_PLAYER_draw_demo',card_movements:[{from:'Main Deck',to:'Hand',count:1,known:false,card_ids:[]}]}];
 const privateDetail=formatter('PLAYER',concealed[0].id,concealed);
 assert(!privateDetail?.html?.includes('played-public-pickup'));
});
if(!process.exitCode)console.log('RC41 F18/F19 QA:',count,'checks PASS');
