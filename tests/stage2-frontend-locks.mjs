import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import vm from 'node:vm';
const root=process.cwd(),read=p=>readFileSync(join(root,p),'utf8');
const sha=p=>createHash('sha256').update(readFileSync(join(root,p))).digest('hex');
let n=0;
const check=(name,fn)=>{fn();console.log('PASS',name);n++};
const networkFrozen={
 'server.js':'60b9d9789f126044e5fa118d0c143015af08bc287fff442c5c2782ffd89f5d25',
 'server/headless-rc32.mjs':'5adb13c7da588989145c080dd822c6b8c6e029e30a273fd0cb012ba619cf7968',
 'server/viewer-safe.mjs':'a800ecdee30db78fbf4613b330c09e6030a3973f48fe009c0e4956c36eb34725',
 'public/battle/runtime/pvp-network.js':'3b3639e8464411def97620489842835052f7e1415b6bf93e1a472e22b91fd2f3',
 'public/battle/runtime/pvp-mana-draft.js':'97519e377f92a0f496f3dcd024020103adb15764eb08d65580b81c6fc28e5cf7',
 'public/battle/runtime/adapters/pvp-adapter.js':'c0ac42811adcf9c663284d09edadc98ab24c8c6c40c184e3bd645b4964f45d72',
 'public/pvp/pvp-host.js':'5a0521ef7f6b13d3c9e3bc983783f3539efadb5b0886d89eb13840cd23f99113',
 'public/battle/runtime/adapters/authority-adapter.js':'859992904b9cc814e8a3ae249e60431c9eafdcd90a7c81db236b60458fabbb00',
 'public/battle/runtime/adapters/local-ai-adapter.js':'0ad1eb6c2b312dffa11364c120eee2607c6f57ddf864b6e84ff2d41770682f58'
};
check('network/server/mana adapter are byte-exact locked to successful Stage1',()=>{
 for(const [p,h] of Object.entries(networkFrozen))assert.equal(sha(p),h,p);
});
const battle=read('public/battle/index.html'),ui=read('public/battle/shared-app/app-runtime.js'),css=read('public/battle/shared-ui/battlefield-ui.css');
check('thumbnail loader precedes presentation runtime and never changes the server',()=>{
 const thumb=battle.indexOf('src="runtime/pvp-card-thumbnails.js"');
 const loader=battle.indexOf('src="runtime/pvp-artwork-loader.js"');
 const runtime=battle.indexOf('src="shared-app/app-runtime.js');
 assert.ok(thumb>=0&&loader>thumb&&runtime>loader);
 assert.ok(ui.includes("priority:'hero'")&&ui.includes("priority:'attachment'")&&ui.includes("priority:'hand'"));
 assert.ok(!ui.includes('card.classList.add(\'gl-hand-art-awaiting\')'));
});
check('completed Draw animations cannot permanently hide known Hand faces',()=>{
 assert.match(ui,/Recovered committed Draw presentation after animation timeout/);
 assert.match(ui,/if\(epoch!==glPresentationEpoch\)return/);
 assert.match(ui,/if\(glHiddenCommittedDrawSlots\[side\]\.get\(idx\)!==token\)continue/);
 assert.match(ui,/if\(to&&glHiddenCommittedDrawSlots\[side\]\.get\(idx\)===token\)to\.classList\.add\('gl-presentation-hidden'\)/);
 assert.match(ui,/if\(to&&!glHiddenCommittedDrawSlots\[side\]\.has\(idx\)\)to\.classList\.remove/);
});
check('Card Review has a permanent external CLOSE and cannot be hidden by CSS READY',()=>{
 assert.match(ui,/gl-card-review-outer-close gl-card-review-close/);
 assert.match(ui,/const oldFrame=body.querySelector\('\.gl-db158-review-frame'\)/);
 assert.match(ui,/cardReviewOverlay.classList.add\('open'\)/);
 assert.match(ui,/if\(e\.target===cardReviewOverlay\)closeCardReview\(\)/);
 assert.match(ui,/e\.key==='Escape'&&cardReviewOverlay.classList.contains\('open'\)/);
 assert.ok(css.includes('.gl-card-review-body.gl-review-loading .gl-db158-review-frame{opacity:1!important;visibility:visible!important;pointer-events:auto!important}'));
 assert.ok(css.includes('.gl-card-review-body:has(.gl-review-emergency-art) .gl-db158-review-frame{display:none!important}'));
});
check('Search scroll uses a deterministic decision identity, not cloned object identity',()=>{
 const match=ui.match(/function returnToHandSearchSessionKey\(s,p\)\{[\s\S]*?\n\}\n(?=function resetReturnToHandSearchDisplay)/);
 assert.ok(match,'decision identity function absent');
 const key=vm.runInNewContext(`(function(){const glPresentationEpoch=3;const candidateSourceZone=()=>\"deck\";return (${match[0].trim()});})()`);
 const snap={round:2,turn:'PLAYER',phase:'Deploy'};
 const choice={type:'card_search_choice',source_card_id:'S0-ITM-018',commit_token:'selection-99',resolve_to:'hand',title:'Select 1',instruction:'Pick',candidates:[{card_id:'S0-WAR-001',deck_index:3},{card_id:'S0-ARC-005',deck_index:12}],selected_indices:[]};
 const clone=x=>JSON.parse(JSON.stringify(x));
 const old=key(snap,choice);
 const selected={...clone(choice),selected_indices:[1],selected_index:1,committing:false};
 assert.equal(key(clone(snap),selected),old,'selection redraw must keep scroll');
 assert.notEqual(key(snap,{...choice,commit_token:'different'}),old,'next decision must reset scroll');
});
check('optional Swap shows server-owned legal partners, Hero/Legacy preview, and SKIP',()=>{
 assert.match(ui,/Array\.isArray\(p\.swap_options\)\?p\.swap_options/);
 assert.match(ui,/button\.disabled=!permitted/);
 assert.match(ui,/if\(permitted\)button\.onclick=\(\)=>intent\('performOptionalSwapDecision'/);
 assert.match(ui,/window\.GL_PVP_ARTWORK\?\.thumb\?\.\(id\)/);
 assert.match(css,/\.gl-swap-choice-slot/);
});
check('lobby changes affect only header nav and Rank component, not PvP rules',()=>{
 const head=read('scripts/website-overlay/pvp/lobby/pvp-shared-header-20261120.css');
 const rank=read('public/pvp/s0-rc32-hero-setup.css');
 assert.match(head,/left:calc\(50% - 50vw\)!important/,'header should occupy full visual viewport exactly once');
 assert.match(head,/width:100vw!important/,'header must not be clipped by a centered lobby container');
 assert.match(head,/padding-right:29px!important/,'navigation must match shared right gutter');
 assert.match(head,/grid-template-columns:34px 84px 34px!important/,'rank style must retain VS AI track widths');
 assert.match(head,/#pvpRankPrev::before/);
 assert.match(head,/#pvpRankNext::before/);
 assert.match(head,/#pvpSetupOverlay \.pvp-v260-app-links\.gl-site-app-nav/);
 assert.match(head,/justify-self:end!important/);
 assert.match(rank,/grid-template-columns:34px 84px 34px/);
 assert.match(rank,/border-radius:8px/);
 assert.match(rank,/height:34px/);
});
// True (mocked DOM) Card Review module test: create once, update twice, never
// replace srcdoc or block on slow image.decode() / document.fonts.ready.
check('real Card Review mount reuses its iframe and redraws latest requested card',()=>{
 const source=read('public/battle/shared-app/db158-card-review.js');
 const cards={'S0-WAR-001':{id:'S0-WAR-001',name:'A',family:'Skill',image:'card-art/S0-WAR-001.webp'},
              'S0-WAR-002':{id:'S0-WAR-002',name:'B',family:'Skill',image:'card-art/S0-WAR-002.webp'}};
 const rendered=[],bound=[],children=[],classes=new Set();
 const pendingFace={setAttribute(n,value){this[n]=value}};
 const reviewArt={dataset:{},src:''};
 const progression={hidden:true};
 const progressionHost={replaceChildren(){},appendChild(){}};
 const d={getElementById(id){return({reviewArt,reviewProgression:progression,reviewProgressionCards:progressionHost})[id]||null},
   querySelector(){return {getBoundingClientRect(){return {bottom:450}}}}};
 const w={GL_S0_REVIEW_RENDER:c=>rendered.push(c.id),requestAnimationFrame:fn=>fn()};
 const body={querySelector:s=>s==='.gl-db158-review-frame'?children.find(x=>x.tagName==='IFRAME')||null:
    s==='.gl-review-loading-art'?pendingFace:null,
    appendChild(x){children.push(x);x.parentElement=this;x.isConnected=true},
    classList:{add:x=>classes.add(x)}};
 const doc={baseURI:'https://game.example/pvp/battle/',readyState:'loading',addEventListener(){},documentElement:{classList:{contains(){return false}}},
   createElement(tag){if(tag!=='iframe')throw Error('unexpected '+tag);return{tagName:'IFRAME',
     style:{setProperty(){}},setAttribute(){},addEventListener(k,fn){this['_on'+k]=fn},contentWindow:null,contentDocument:null}}};
 const g={document:doc,innerHeight:900,GL_DB166_REVIEW_CARDS:cards,GL_PVP_ARTWORK:{bind:(img,opts)=>{bound.push(opts.cardId);img.src=opts.src;return true}},
    setTimeout:()=>0,requestIdleCallback:()=>0};
 const ctx={window:g,URL,console};vm.runInNewContext(source,ctx,{timeout:20000});
 const api=g.GL_DB158_REVIEW;assert.ok(api);
 assert.equal(api.mount(body,'S0-WAR-001',[]),true);
 assert.equal(children.length,1);
 const frame=children[0],html=frame.srcdoc;
 assert.equal((html.match(/<link rel="stylesheet"/g)||[]).length,1,'review must load exactly one CSS bundle');
 assert.ok(html.includes('pvp-review-bundle-rc40-20261116.css'));
 assert.equal(api.mount(body,'S0-WAR-002',[]),true,'update requested while iframe loads');
 assert.equal(children.length,1,'should never create a second iframe');
 frame.contentWindow=w;frame.contentDocument=d;frame._onload();
 assert.equal(rendered.at(-1),'S0-WAR-002','slow iframe must present newest card, not stale first card');
 assert.ok(classes.has('gl-review-ready'));
 assert.equal(api.mount(body,'S0-WAR-001',[]),true);
 assert.equal(children.length,1);
 assert.equal(frame.srcdoc,html,'CSS and JS iframe shall not reload between cards');
 assert.deepEqual(rendered,['S0-WAR-002','S0-WAR-001']);
 assert.deepEqual(bound,['S0-WAR-002','S0-WAR-001']);
});
console.log(`STAGE 2 FRONTEND ${n}/${n} PASS`);
