'use strict';
/* 17 Nov RC40 VS AI donor + v3.4 rulebook + M01/M02/M03 responsive PvP guard.
 * The real Season 0 engine is loaded, not an imitation of card validation. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../public/battle');
const project=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(project,p),'utf8');
const ctx={console,URL,Date,Math,Array,JSON,Map,Set,Promise,Uint8Array,TextDecoder,TextEncoder,
  performance:{now:()=>0},setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
  requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},crypto:require('node:crypto').webcrypto};
ctx.window=ctx;ctx.globalThis=ctx;ctx.location={href:'http://example.test/',origin:'http://example.test'};
ctx.navigator={userAgent:'RC40 v3.4 donor test'};ctx.document={readyState:'loading',addEventListener:()=>{},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],body:null,documentElement:null};
vm.createContext(ctx);
for(const f of ['engine/js/static-data.js','engine/js/runtime-authority.js','engine/shared-app/active-starters.js','engine/shared-app/app.bundle.js']){
 let src=fs.readFileSync(path.join(root,f),'utf8');
 if(f.endsWith('app.bundle.js')){
  src=src.replace('function showResult(){','function showResult(){if(SUPPRESS_RENDER)return;');
  src=src.replace('function showInfo(title, body){','function showInfo(title, body){if(SUPPRESS_RENDER)return;');
  assert.match(src,/\n\}\)\(\);\s*$/);
  src=src.replace(/\n\}\)\(\);\s*$/,`\nwindow.__V34_QA={initCards,card,validateDeck,sourceCompatibleForMode,heroState,sourceCompatibleForResponse};\n})();`);
 }
 vm.runInContext(src,ctx,{timeout:60000,filename:f});
}
ctx.GL_LOCAL_AI_BRIDGE.setRenderSuppressed(true);ctx.__V34_QA.initCards();
const R=ctx.__V34_QA,clone=v=>JSON.parse(JSON.stringify(v)),all=ctx.GL_CARD_DEFINITIONS.cards;
let checks=0;
function check(label,fn){fn();checks++;console.log('PASS',label)}
check('Rulebook v3.4: all five official starter decks remain legal',()=>{
 for(const [id,entry] of Object.entries(ctx.GL_ACTIVE_STARTER_DECKS)){
  const result=R.validateDeck(entry.deck||entry,'PLAYER');assert(result.ok,id+': '+result.errors.join('; '));
 }
});
const nonultimate=all.filter(c=>c.family==='Skill'&&!c.is_ultimate).map(c=>c.card_id).slice(0,17);
assert.equal(nonultimate.length,17);
const base=clone(ctx.GL_ACTIVE_STARTER_DECKS.s0_starter_01_red_white.deck);
base.main_deck=nonultimate.map((card_id,i)=>({card_id,quantity:i===16?2:3}));
// Use 16x3 + 1x2 = 50 ordinary legal Skills.
const baseline=R.validateDeck(clone(base),'PLAYER');assert(baseline.ok,baseline.errors.join('\n'));
const ult=all.filter(c=>c.is_ultimate&&R.card(c.card_id)?.requirement?.ultimate?.owner);
const owners=new Map();for(const c of ult){const owner=R.card(c.card_id).requirement.ultimate.owner;if(!owners.has(owner))owners.set(owner,c.card_id)}
const four=[...owners.values()].slice(0,4);assert.equal(four.length,4);
function withUltimates(ids){const b=clone(base);ids.forEach((id,i)=>{b.main_deck[i].quantity--;b.main_deck.push({card_id:id,quantity:1});});return b}
check('Rulebook v3.4: up to three Ultimate Cards from different Heroes allowed',()=>{
 const v=R.validateDeck(withUltimates(four.slice(0,3)),'PLAYER');assert(v.ok,v.errors.join('\n'));
});
check('Rulebook v3.4: a fourth Ultimate is rejected by the canonical engine',()=>{
 const v=R.validateDeck(withUltimates(four),'PLAYER');assert(!v.ok);
 assert(v.errors.some(x=>/at most 3 Ultimate Cards/i.test(x)),JSON.stringify(v.errors));
});
check('Rulebook v3.4: two Ultimate copies bound to the same Hero rejected',()=>{
 const v=R.validateDeck(withUltimates([four[0],four[0]]),'PLAYER');assert(!v.ok);
 assert(v.errors.some(x=>/per Hero/i.test(x)),JSON.stringify(v.errors));
});
check('Rulebook v3.4: Stun/Exhaust do not ban an otherwise legal Item',()=>{
 const h=R.heroState('S0-WAR-H001','PLAYER','LEFT');h.statuses=[{name:'Stun',duration:2}];h.exhausted=true;
 assert.equal(R.sourceCompatibleForMode(R.card('S0-ITM-001'),h,{response:false}),true);
 assert.equal(R.sourceCompatibleForMode(R.card('S0-WAR-001'),h,{response:false}),false);
 assert.equal(R.sourceCompatibleForResponse(R.card('S0-ITM-016'),h),true);
});
check('VS AI M03 two-tap Discard selection: phone, same pile, other pile, desktop',()=>{
 for(const f of [read('public/battle/shared-app/app-runtime.js'),fs.readFileSync(path.join(project,'../website/pvp/battle/shared-app/app-runtime.js'),'utf8')]){
  const start=f.indexOf('// M03: a first handset tap arms');const end=f.indexOf('function configureStaticZones(){',start);
  assert(start>=0&&end>start);
  const listeners=[];let targetTimer=0;
  const sandbox={window:{innerWidth:390,innerHeight:800},navigator:{maxTouchPoints:1},
   matchMedia:()=>({matches:true}),setTimeout:(fn)=>{targetTimer=fn;return 7},clearTimeout:()=>{targetTimer=0},
   document:{addEventListener:(type,fn,capture)=>{assert.equal(type,'pointerdown');assert.equal(capture,true);listeners.push(fn)}}};
  vm.createContext(sandbox);
  vm.runInContext(f.slice(start,end)+`\nthis.tap=mobileDiscardDoubleTapGate;this.cancel=clearMobileDiscardArm;`,sandbox);
  const makePile=()=>({classList:{held:false,add(x){assert.equal(x,'gl-discard-tap-armed');this.held=true},remove(){this.held=false}}});
  const a=makePile(),b=makePile();let opened=0;
  sandbox.tap(a,()=>opened++);assert.equal(opened,0);assert(a.classList.held);
  sandbox.tap(b,()=>opened++);assert.equal(opened,0);assert(!a.classList.held);assert(b.classList.held);
  sandbox.tap(b,()=>opened++);assert.equal(opened,1);assert(!b.classList.held);
  sandbox.tap(a,()=>opened++);listeners[0]({target:{closest:()=>null}});assert(!a.classList.held);
  sandbox.window.innerWidth=1500;sandbox.window.innerHeight=900;
  sandbox.tap(a,()=>opened++);assert.equal(opened,2);
  sandbox.cancel();
 }
});
check('M01 native PvP mobile deck menu present on both surfaces',()=>{
 for(const f of [read('public/pvp/pvp-host.js'),fs.readFileSync(path.join(project,'../website/pvp/pvp/pvp-host.js'),'utf8')]){
  for(const key of ['pvpMobileDeckMenuToggle','pvpMobileDeckMenu','data-pvp-mobile-deck','showPicker','pvpImportDeckInput'])assert(f.includes(key),key);
 }
});
check('M02 logical stage does not rotate PvP modals twice and includes EXP and notices',()=>{
 for(const f of [read('public/battle/runtime/pvp-mobile-landscape-fix.css'),fs.readFileSync(path.join(project,'../website/pvp/battle/runtime/pvp-mobile-landscape-fix.css'),'utf8')]){
  assert.match(f,/\.gl-exp-inspector-overlay/);assert.match(f,/glPvpMobileArtNotice/);assert.match(f,/glPvpMobileChainNotice/);
  assert.match(f,/body\{[\s\S]*?transform:var\(--gl-stage-transform\)/);
  assert.doesNotMatch(f,/\.gl-exp-inspector-overlay\{[\s\S]{0,400}transform:var\(--gl-stage-transform\)/);
 }
});
check('Server and Website static build ID synchronized',()=>{
 const server=read('server.js'),meta=fs.readFileSync(path.join(project,'../website/pvp/build-meta.js'),'utf8');
 const m=/const BUILD_ID='([^']+)'/.exec(server);assert(m&&meta.includes(m[1]),'server / website build mismatch');
});
check('Old PvP public pickup, Item arrow, Mana receipt and spectator privacy paths retained',()=>{
 const s=read('server/viewer-safe.mjs'),e=read('public/battle/engine/shared-app/app.bundle.js'),u=read('public/battle/shared-app/app-runtime.js');
 for(const k of ['CARD_PUBLIC_PICKUP','MANA_LOSS_COMMITTED'])assert(e.includes(k),k+' donor engine');
 assert(s.includes('CARD_PUBLIC_PICKUP'),'viewer public card pickup');
 for(const k of ['public_card_target','MANA_LOSS_COMMITTED','mobileDiscardDoubleTapGate'])assert(u.includes(k),k+' UI');
 assert(s.includes('assertViewerSafeBoard'));
});
console.log('RESULT '+checks+'/'+checks+' v3.4/mobile donor tests passed');
