// RC40 VS AI -> PvP targeted parity and recipient-safe projection regression.
// Source/engine fixtures; live browser/WSS tests must be separately reported.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {viewerSafeBoard,assertViewerSafeBoard} from '../server/viewer-safe.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
let passed=0;
function check(desc,fn){fn();passed++;console.log('PASS',desc)}
const engine=read('public/battle/engine/shared-app/app.bundle.js');
const ui=read('public/battle/shared-app/app-runtime.js');
const safe=read('server/viewer-safe.mjs');
const css=read('public/battle/shared-ui/battlefield-ui.css');
const reviewSources=['public/battle/shared-app/db158-card-review.js','public/pvp/db158-card-review.js'];
const stylesRoot='public/battle/assets/review-db158/css/';
const bundleName='pvp-review-bundle-rc40-20261116.css';

// Run the real donor engine (not a mock of selection/reduction behavior).
const ctx={console,URL,Date,Math,Array,JSON,Map,Set,Promise,Uint8Array,TextDecoder,TextEncoder,
 performance:{now:()=>0},setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},clearInterval(){},
 requestAnimationFrame(){},cancelAnimationFrame(){},crypto:webcrypto};
ctx.window=ctx;ctx.globalThis=ctx;
ctx.location={href:'http://test/index.html',origin:'http://test'};
ctx.navigator={userAgent:'RC40 PvP selected pickup QA'};
ctx.document={readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null},
 querySelectorAll(){return []},createElement(){return {style:{},appendChild(){},setAttribute(){}}},
 documentElement:{classList:{toggle(){}}},body:{appendChild(){}}};
vm.createContext(ctx);
for(const file of ['public/battle/engine/js/static-data.js','public/battle/runtime/overrides/grand-finale-designer-nerf.js',
 'public/battle/engine/js/runtime-authority.js','public/battle/engine/shared-app/active-starters.js',
 'public/battle/engine/shared-app/app.bundle.js']){
 let src=read(file);
 if(file.endsWith('/app.bundle.js'))src=src.replace(/\n\}\)\(\);\s*$/,
 `window.__PVP_QA={initCards,card,isUltimateCard,buildInitialMatchState,startCardSearchChoice,
 selectCardSearchChoice,commitCardSearchChoice,glPvpSwapKeys,
 get state(){return appState},setState:s=>{appState=s;matchStarted=true;SUPPRESS_RENDER=true}};\n})();`);
 vm.runInContext(src,ctx,{filename:file,timeout:60000});
}
ctx.GL_LOCAL_AI_BRIDGE.setRenderSuppressed(true);
const q=ctx.__PVP_QA;
assert(q,'Real PvP runtime extraction failed');q.initCards();
const defs=ctx.GL_CARD_DEFINITIONS.cards;
const ultimate=defs.find(c=>c.family==='Skill'&&q.isUltimateCard(q.card(c.card_id)));
const regular=defs.find(c=>c.family==='Skill'&&!q.isUltimateCard(q.card(c.card_id)));
assert(ultimate&&regular);
function fresh(side){
 const s=q.buildInitialMatchState();
 s.turn=side;s.phase='Deploy';s.pending=null;s.responseWindow=null;
 s.gameOver=false;s.openingFlowCompleted=true;s.preGame=null;s.aiDifficulty='beginner';
 s.playerDeck=[ultimate.card_id,regular.card_id];s.aiDeck=[ultimate.card_id,regular.card_id];
 s.playerHand=[];s.aiHand=[];q.setState(s);return s;
}
function chooseMain(side){return q.startCardSearchChoice(q.state,{side,zone:'deck',sourceCard:q.card('S0-ITM-018'),
 filter:{family:'Skill',is_ultimate:false},title:'Magic Compass',instruction:'Choose non-Ultimate Skill'});}
function chooseDiscard(side){return q.startCardSearchChoice(q.state,{side,zone:'discard',sourceCard:q.card('S0-EVT-010'),
 filter:{family:'Skill',is_ultimate:false},title:'Deja Vu'});}
check('real PvP engine: manual Main Deck selection reveals only after commit',()=>{
 const s=fresh('PLAYER');assert(chooseMain('PLAYER'));
 assert.equal(s.presentationEvents.filter(e=>e.type==='CARD_PUBLIC_PICKUP').length,0);
 assert.equal(s.pending.candidates.length,1);
 assert(q.selectCardSearchChoice(0));assert(q.commitCardSearchChoice());
 assert.deepEqual(s.playerHand,[regular.card_id]);
 const p=s.presentationEvents.filter(e=>e.type==='CARD_PUBLIC_PICKUP');
 assert.equal(p.length,1);assert.equal(p[0].side,'PLAYER');assert.equal(p[0].card_id,regular.card_id);
 assert.equal(p[0].from_zone,'Main Deck');
});
check('real PvP engine: opponent-side Main Deck search records public selection',()=>{
 const s=fresh('AI');
 assert.equal(chooseMain('AI'),false); // local donor AI auto-selection fixture only; actual PvP is human-human
 assert.deepEqual(s.aiHand,[regular.card_id]);
 const p=s.presentationEvents.filter(e=>e.type==='CARD_PUBLIC_PICKUP');
 assert.equal(p.length,1);assert.equal(p[0].side,'AI');assert.equal(p[0].card_id,regular.card_id);
});
check('real PvP engine: manual Discard selection records correct face-up card',()=>{
 const s=fresh('PLAYER');s.playerDiscard=[ultimate.card_id,regular.card_id];
 assert(chooseDiscard('PLAYER'));assert.equal(s.pending.candidates.length,1);
 assert.equal(s.presentationEvents.filter(e=>e.type==='CARD_PUBLIC_PICKUP').length,0);
 assert(q.selectCardSearchChoice(0));assert(q.commitCardSearchChoice());
 assert.deepEqual(s.playerHand,[regular.card_id]);
 const p=s.presentationEvents.filter(e=>e.type==='CARD_PUBLIC_PICKUP');
 assert.equal(p.length,1);assert.equal(p[0].from_zone,'Discard');assert.equal(p[0].side,'PLAYER');
});
check('real PvP engine: opponent-side Discard selection records public card',()=>{
 const s=fresh('AI');s.aiDiscard=[ultimate.card_id,regular.card_id];
 assert.equal(chooseDiscard('AI'),false);
 assert.deepEqual(s.aiHand,[regular.card_id]);
 const p=s.presentationEvents.filter(e=>e.type==='CARD_PUBLIC_PICKUP');
 assert.equal(p.length,1);assert.equal(p[0].side,'AI');assert.equal(p[0].card_id,regular.card_id);
});
check('real PvP engine: seat-2 rebasing maps the source pickup to opposing AI side',()=>{
 const s=fresh('PLAYER');assert(chooseMain('PLAYER'));assert(q.selectCardSearchChoice(0));assert(q.commitCardSearchChoice());
 const flipped=q.glPvpSwapKeys(s);
 assert.equal(s.presentationEvents.find(e=>e.type==='CARD_PUBLIC_PICKUP').side,'PLAYER');
 assert.equal(flipped.presentationEvents.find(e=>e.type==='CARD_PUBLIC_PICKUP').side,'AI');
 assert.equal(flipped.presentationEvents.find(e=>e.type==='CARD_PUBLIC_PICKUP').card_id,regular.card_id);
 const v=viewerSafeBoard({appState:flipped},{seat:2,revision:15,secret:'s'});
 assertViewerSafeBoard(v);
 assert.equal(v.appState.presentationEvents.find(e=>e.type==='CARD_PUBLIC_PICKUP').card_id,regular.card_id);
 assert.equal(v.appState.presentationEvents.find(e=>e.type==='CARD_PUBLIC_PICKUP').side,'AI');
});
check('real PvP engine: seat-2 own pickup maps to local PLAYER side',()=>{
 const s=fresh('AI');assert.equal(chooseMain('AI'),false);
 const flipped=q.glPvpSwapKeys(s);
 assert.equal(flipped.presentationEvents.find(e=>e.type==='CARD_PUBLIC_PICKUP').side,'PLAYER');
 const v=viewerSafeBoard({appState:flipped},{seat:2,revision:16,secret:'s'});
 assertViewerSafeBoard(v);
 assert.equal(v.appState.presentationEvents.find(e=>e.type==='CARD_PUBLIC_PICKUP').side,'PLAYER');
});
check('ordinary Draw never calls public-selection event helper',()=>{
 const e=engine.slice(engine.indexOf('function recordPublicSelectedPickup('),engine.indexOf('function recordCardNegationPresentation('));
 assert(e.includes('CARD_PUBLIC_PICKUP'));assert(!e.includes('CARD_DRAWN'));
 assert.equal((engine.match(/recordPublicSelectedPickup\(/g)||[]).length,7);
 assert(ui.includes("if(e.type==='CARD_DRAWN')plan.draws.push(e)"));
 assert(ui.includes("e.type==='CARD_PUBLIC_PICKUP'"));
});

function rawState(seat=1,fromZone='Main Deck'){
 return {appState:{turn:'PLAYER',phase:'Deploy',round:2,
   playerHand:['S0-ITM-001'],aiHand:['S0-ITM-002'],
   playerDeck:['S0-ITM-009'],aiDeck:['S0-ITM-020'],
   playerLegacy:['S0-WAR-H001'],aiLegacy:['S0-ARC-H001'],
   playerManaDeck:[{uid:'SECRET-P-MANA',kind:'CLASS'}],aiManaDeck:[{uid:'SECRET-AI-MANA',kind:'CLASS'}],
   playerManaPoolCards:[{uid:'VISIBLE-OWN-MANA',kind:'MANA'}],
   aiManaPoolCards:[{uid:'SECRET-ENEMY-MANA',kind:'CLASS',class_name:'Mage'}],
   presentationEvents:[
    {id:'PICKUP-14',type:'CARD_PUBLIC_PICKUP',side:'AI',card_id:regular.card_id,
      source_card_id:'S0-ITM-018',from_zone:fromZone,hand_index:2},
    {id:'DRAW-10',type:'CARD_DRAWN',side:'AI',card_id:ultimate.card_id,hand_index:3},
    {id:'DRAW-11',type:'CARD_DRAWN',side:'PLAYER',card_id:'S0-ITM-003',hand_index:0}
   ],pending:{type:'opponent_unknown_choice',decision_side:'AI',superSecret:'HAND SECRET'},
   pvpActionEventsBySide:{PLAYER:[],AI:[]}
 }};
}
for(const seat of [1,2])for(const fromZone of ['Main Deck','Discard']){
 check(`seat ${seat}: public ${fromZone} selected card safe / ordinary Draw remains hidden`,()=>{
  const canonical=rawState(seat,fromZone);
  const safeBoard=viewerSafeBoard(canonical,{seat,revision:12,secret:'test-pvp-secret'});
  assertViewerSafeBoard(safeBoard);
  assert.equal(safeBoard.pvpRecipientSeat,seat);
  const ev=safeBoard.appState.presentationEvents;
  assert.equal(ev.find(e=>e.type==='CARD_PUBLIC_PICKUP').card_id,regular.card_id);
  assert.equal(ev.find(e=>e.type==='CARD_PUBLIC_PICKUP').from_zone,fromZone);
  assert.equal('hand_index' in ev.find(e=>e.type==='CARD_PUBLIC_PICKUP'),false);
  assert.equal('card_id' in ev.find(e=>e.id==='DRAW-10'),false);
  assert.equal(ev.find(e=>e.id==='DRAW-11').card_id,'S0-ITM-003');
  assert(!JSON.stringify(safeBoard).includes(ultimate.card_id));
  assert(!JSON.stringify(safeBoard).includes('HAND SECRET'));
  assert(!JSON.stringify(safeBoard).includes('SECRET-ENEMY-MANA'));
  assert(canonical.appState.aiHand.includes('S0-ITM-002'),'projection must not mutate canonical');
 });
}
check('selected public card with invalid ID or zone is rejected',()=>{
 for(const [from_zone,card_id] of [['Hand',regular.card_id],['Main Deck','INVALID'],['Discard','S0-<script>']]){
  const st=rawState();st.appState.presentationEvents=[{id:'PICKUP-1',type:'CARD_PUBLIC_PICKUP',side:'AI',card_id,from_zone}];
  const view=viewerSafeBoard(st,{seat:1,revision:4,secret:'s'});
  assert.equal(view.appState.presentationEvents.filter(e=>e.type==='CARD_PUBLIC_PICKUP').length,0);
 }
});
check('public status duration fields survive server projection for status UI',()=>{
 const st=rawState();st.appState.pvpActionEventsBySide.PLAYER=[{id:'A-1',card_id:'S0-THF-018',
  label:'ATK',title:'Venom Attack',source_side:'PLAYER',source_lane:'LEFT',target_side:'AI',target_lane:'RIGHT',
  status_breakdown_by_hero:[{name:'Target Hero',side:'AI',lane:'RIGHT',status:'Poison',
    previous_duration:1,final_duration:4,base_duration:2,bonus_duration:1,
    bonus_name:'Public Passive',duration_applied:3,limit:6}]}];
 const view=viewerSafeBoard(st,{seat:1,revision:4,secret:'s'});
 const rows=view.appState.pvpActionEventsBySide.PLAYER[0].status_by_hero;
 assert.equal(rows.length,1);
 for(const [k,v] of Object.entries({before:1,after:4,base_duration:2,bonus_duration:1,duration_applied:3,
  bonus_name:'Public Passive',limit:6,status:'Poison',side:'AI',lane:'RIGHT'}))assert.equal(rows[0][k],v,k);
 assert.equal(view.appState.pvpActionEventsBySide.PLAYER[0].effect_results,undefined);
});
check('status projection rejects private or unknown statuses',()=>{
 const st=rawState();st.appState.pvpActionEventsBySide.AI=[{id:'A-2',card_id:'S0-THF-018',label:'ATK',
 status_breakdown_by_hero:[{name:'Hero',side:'AI',lane:'RIGHT',status:'SECRET',before:0,after:9},
 {name:'Hero',side:'AI',lane:'RIGHT',status:'Burn',before:0,after:2}]}];
 const view=viewerSafeBoard(st,{seat:2,revision:5,secret:'s'});
 assert.equal(view.appState.pvpActionEventsBySide.AI[0].status_by_hero.length,1);
 assert.equal(view.appState.pvpActionEventsBySide.AI[0].status_by_hero[0].status,'Burn');
});
check('client adapts status metadata for the shared VS AI Card Played renderer',()=>{
 const start=ui.indexOf('function pvpCanonicalPlayedEvent(e){');
 const end=ui.indexOf('\nfunction ',start+10);
 assert(start>=0&&end>start);
 const extract=ui.slice(start,end);
 const script=extract+'\nthis.__convert=pvpCanonicalPlayedEvent;';
 const c={cv:()=>({name:'Hero'}),Object,Number,Array,Math,console};
 vm.createContext(c);vm.runInContext(script,c);
 const result=c.__convert({id:'T-1',card_id:'S0-THF-018',label:'ATK',status_by_hero:[{
  name:'Hero',side:'AI',lane:'RIGHT',status:'Poison',before:0,after:3,
  base_duration:2,bonus_duration:1,bonus_name:'Public Passive',duration_applied:3,limit:6
 }]});
 assert.equal(result.status_breakdown[0].base_duration,2);
 assert.equal(result.status_breakdown[0].bonus_duration,1);
 assert.equal(result.status_breakdown[0].duration_applied,3);
 assert.equal(result.status_breakdown[0].bonus_name,'Public Passive');
});
check('client notices only opponent deliberate selection, groups same resolved source',()=>{
 const start=ui.indexOf('function queuePvpPublicPickupNotice(events){');
 const end=ui.indexOf('function showCommittedCounterBanner(evt){',start);
 assert(start>=0&&end>start);
 const context={window:{GL_APP_MODE:'PVP'},presentationPrimed:true,openingPresentationActive:false,
   presentationNoticeQueue:[],showNextPresentationNotice(){},console};
 vm.createContext(context);
 vm.runInContext(ui.slice(start,end)+'\nthis.__show=queuePvpPublicPickupNotice;',context);
 context.__show([
  {type:'CARD_PUBLIC_PICKUP',side:'AI',card_id:'S0-ITM-001',source_card_id:'S0-ITM-018',from_zone:'Main Deck'},
  {type:'CARD_PUBLIC_PICKUP',side:'AI',card_id:'S0-ITM-002',source_card_id:'S0-ITM-018',from_zone:'Main Deck'},
  {type:'CARD_PUBLIC_PICKUP',side:'PLAYER',card_id:'S0-ITM-003',from_zone:'Main Deck'},
  {type:'CARD_DRAWN',side:'AI',card_id:'S0-WAR-H001'},
 ]);
 assert.equal(context.presentationNoticeQueue.length,1);
 assert.equal(context.presentationNoticeQueue[0].kind,'card-art');
 assert.equal(context.presentationNoticeQueue[0].cardIds.length,2);
 assert.equal(context.presentationNoticeQueue[0].title,'OPPONENT ADDED TO HAND');
});
check('preview CSS uses one bundled stylesheet and starts warming early',()=>{
 const body=read(stylesRoot+bundleName);
 const blocks=[...body.matchAll(/\/\* SOURCE: ([^*]+?) \*\/\n/g)].map(x=>x[1]);
 assert.equal(blocks.length,19);
 const reconstructed=blocks.map(name=>'\n/* SOURCE: '+name+' */\n'+read(stylesRoot+name).trimEnd()+'\n').join('');
 assert.equal(body,reconstructed,'CSS bundle must preserve every original rule and order');
 for(const f of reviewSources){const s=read(f);
   assert(s.includes("var files=['"+bundleName+"']"),f);
   assert(s.includes('requestIdleCallback(warmStyles,{timeout:1200})'));
   assert(s.includes('setTimeout(warmStyles,300)'));
 }
 assert(css.includes('.gl-counter-banner.is-card-art'));
 assert(css.includes('.gl-card-notice-gallery'));
});
check('public pickup is separate from existing Paladin notice, arrow and privacy logic',()=>{
 assert(ui.includes('publicPicks'));
 assert(ui.includes('rw.public_card_target'));
 assert(ui.includes("event?.type!=='MANA_LOSS_COMMITTED'"));
 assert(safe.includes('public_card_target'));
});
check('client and server use a single build identity',()=>{
 const build='gl-s0-pvp-rc40-patch32-vsai-parity-2026-11-16';
 assert(read('server.js').includes("const BUILD_ID='"+build+"'"));
 assert(read('public/index.html').includes(build));
 assert(read('public/battle/index.html').includes(build));
});
console.log(`RC40 VS AI -> PvP parity ${passed}/${passed} targeted checks PASS`);
