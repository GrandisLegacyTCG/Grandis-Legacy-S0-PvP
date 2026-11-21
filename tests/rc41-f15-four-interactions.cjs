'use strict';
// Four reported interaction defects: use real production source and donor F15.
const fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../public/battle');
const rd=p=>fs.readFileSync(path.join(root,p),'utf8');
const ctx={console,Date,URL,Math,Array,JSON,Map,Set,Promise,Uint8Array,TextDecoder,TextEncoder,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},requestAnimationFrame:()=>0,crypto:crypto.webcrypto};
ctx.window=ctx;ctx.globalThis=ctx;ctx.location={href:'http://audit.invalid/battle/',origin:'http://audit.invalid'};ctx.navigator={userAgent:'node'};
ctx.document={readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null},querySelectorAll(){return[]},createElement(){return{style:{},appendChild(){},setAttribute(){}}},documentElement:{classList:{toggle(){}}},body:{appendChild(){}}};
vm.createContext(ctx);
for(const name of ['engine/js/static-data.js','assets/review-db158/js/db166-view-model.js','engine/js/runtime-authority.js','engine/shared-app/active-starters.js','runtime/season0-generated/rc41-approved-print-overrides.js','runtime/season0-generated/rc42-main-deck-r394-overlay.js','engine/shared-app/app.bundle.js']){
 let source=rd(name);if(name.endsWith('app.bundle.js')){
  const idx=source.lastIndexOf('})();');assert(idx>0);
  source=source.slice(0,idx)+'\nwindow.__INTERACTION_QA={initCards};\n'+source.slice(idx);
 }
 vm.runInContext(source,ctx,{filename:name,timeout:30000});
}
ctx.__INTERACTION_QA.initCards();
const engine=ctx.GL_GAME_ENGINE;
assert.equal(typeof engine.getPublicCardPlayedDetail,'function','Card Played must expose public read-only detail formatter');
const journal=[
  {id:'public-atk-1',side:'PLAYER',card_id:'S0-WAR-001',played_event_order:12,card_played_chain_id:'c-55',card_played_chain_step:0,label:'ATK',source_snapshot:{name:'Warrior'},result_lines:['20 Physical damage']},
  {id:'public-def-1',side:'AI',card_id:'S0-WAR-002',played_event_order:13,card_played_chain_id:'c-55',card_played_chain_step:1,response_to_event_id:'public-atk-1',label:'DEF',result_lines:['Blocked incoming damage']}
];
for(const [side,id] of [['PLAYER','public-atk-1'],['AI','public-def-1']]){
 const x=engine.getPublicCardPlayedDetail(side,id,journal);assert(x?.html&&x.html.includes('played-detail-card'),JSON.stringify(x||{}).slice(0,300));
 assert(x.html.includes('S0-WAR-'), 'Donor formatter should render exact played artwork');
 assert(!x.html.includes('S0-SECRET-PRIVATE'), 'No hidden information');
}
assert.equal(engine.getPublicCardPlayedDetail('AI','never-exposed',[...journal]),null);
assert.equal(engine.getPublicCardPlayedDetail('AI','private-1',[...journal,{id:'private-1',card_id:null,side:'AI'}]),null);
console.log('PASS #2 Card Played: both seats click -> donor detail HTML, no hidden journal leak');

// Use actual local physical Mana draft module, not a reimplementation of logic.
const manaCtx={};manaCtx.window=manaCtx;vm.runInNewContext(rd('runtime/pvp-mana-draft.js'),manaCtx);
const d=manaCtx.GL_PVP_MANA_DRAFT;
const pool=[{uid:'r1',kind:'GENERIC'},{uid:'r2',kind:'GENERIC'}];
const pending={type:'mana_shard_payment_choice',decision_side:'PLAYER',card_id:'S0-WAR-001',cost:2,selected_shard_uids:[],shard_choices:pool.map(s=>({uid:s.uid,value:1,kind:'GENERIC'}))};
const state={pending,playerManaPoolCards:pool};
d.sync(state,4);
assert.equal(d.getInfo(state).canPay,false);
assert.equal(d.toggleShard(state,'r1'),true,'first incomplete tap must work');
assert.equal(d.getInfo(state).plan.value,1);
assert.equal(d.toggleShard(state,'r2'),true,'second tap completes payment');
assert.equal(d.getInfo(state).canPay,true);
assert.deepEqual(JSON.parse(JSON.stringify(d.payload(state).args)),[['r1','r2'],false,null]);
assert.equal(d.toggleShard(state,'r1'),true,'user may deselect a Shard even without exact replacement');
assert.equal(d.getInfo(state).canPay,false);
assert.equal(d.toggleShard(state,'r1'),true);
assert.equal(d.getInfo(state).canPay,true);
console.log('PASS #4 Mana: zero initial, incremental selection, manual deselect, valid exact PAY');

const review=rd('shared-app/db158-card-review.js'),runtime=rd('shared-app/app-runtime.js'),styles=rd('shared-ui/battlefield-ui.css');
assert(review.includes('frame.__glPendingReview')&&review.includes("frame.addEventListener('load'"),'Donor F15 review must reuse iframe across card switches');
assert(review.includes('GL_PVP_ARTWORK?.bind')&&!review.includes('Promise.race'),'Card Review must open without blocking on image/font decoding');
assert(runtime.includes('gl-review-emergency-art')&&runtime.includes('3000'),'Missing renderer must have a visible, bounded fallback');
assert(styles.includes('.gl-card-review-body.gl-review-ready .gl-db158-review-frame{visibility:visible'));
assert(!/gl-card-review-body\.gl-review-loading::after[^}]*loading card review/i.test(styles.slice(-2200)));
assert(styles.includes('.gl-card-review-body:has(.gl-review-emergency-art) .gl-db158-review-frame{display:none!important'), 'Emergency artwork must visually replace broken iframe');
assert(runtime.includes('gl-review-emergency-close'),'Failure fallback needs an accessible close button');
console.log('PASS #1 Card Review: F15 cached iframe, decode cap, visible fallback and CSS ready guard');
assert(runtime.includes("title.textContent='Chain Result'"),'Counter banner must have donor title');
assert(runtime.includes("image.src=art(step.card_id)"),'Counter Chain must show artwork not text-only notification');
assert(runtime.includes("if(presentationPrimed)showCommittedCounterChain(evt,s)"));
assert(styles.includes('.gl-counter-chain-card .gl-public-card-art'));
assert(!runtime.includes("queuePresentationNotice('counter','COUNTERED!'"));
console.log('PASS #3 Counter: Chain Result artwork, public committed journal, no legacy COUNTERED notification');
assert(runtime.includes('isReturnToHandSearch(p)')&&runtime.includes('limitReturnToHandSearchRows()'));
assert(styles.includes('.gl-choice-hand-window')&&styles.includes('gl-choice-to-hand-active'));
console.log('PASS F15: Hand-aware search popup integration and two-row layout');
