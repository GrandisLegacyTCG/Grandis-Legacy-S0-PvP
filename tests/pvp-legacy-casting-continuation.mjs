import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {viewerSafeBoard,assertViewerSafeBoard} from '../server/viewer-safe.mjs';
const root=join(process.cwd(),'public/battle');
const src=readFileSync(resolve('server/headless-rc32.mjs'),'utf8');
const anchor='  /** A verified seat may concede without turn/response ownership. */';
const source=src.replace("import {PvpCombatPresentationLedger} from './combat-presentation.mjs';",`import {PvpCombatPresentationLedger} from '${pathToFileURL(resolve('server/combat-presentation.mjs')).href}';`)
.replace("import {PvpDiscardPresentationLedger} from './discard-presentation.mjs';",`import {PvpDiscardPresentationLedger} from '${pathToFileURL(resolve('server/discard-presentation.mjs')).href}';`)
.replace("import {isCompletedOpponentManaContinuation} from './commit-semantics.mjs';",`import {isCompletedOpponentManaContinuation} from '${pathToFileURL(resolve('server/commit-semantics.mjs')).href}';`)
.replace(anchor,`  injectFixture(snapshot){this.#canonical=clone(snapshot);this.#bridgeSeat=null;this.#bridgeRevision=-1;}\n${anchor}`);
assert.ok(source.includes('injectFixture(snapshot)'), 'test-only fixture injection missing');
const {Season0HeadlessAuthority:A}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source));
const create=seat=>{const a=new A(root);a.start({player1DeckKey:'s0_starter_03_red_white',player2DeckKey:'s0_starter_01_blue_red'});a.completeOpening(seat,'HEADS');return a};
const snapshot=a=>a._canonicalForServerOnly();
const state=a=>snapshot(a).appState;
const view=(a,seat)=>{const b=viewerSafeBoard(a._viewForMaskingOnly(seat),{seat,revision:a.revision,secret:Buffer.alloc(32)});assertViewerSafeBoard(b);return b.appState;};
let failed=0;
const browserFixtures=[];
function captureBrowser(a,seat,stage){if(!process.env.GL_RC44_BROWSER_FIXTURES)return;browserFixtures.push({seat,stage,revision:a.revision,board:viewerSafeBoard(a._viewForMaskingOnly(seat),{seat,revision:a.revision,secret:Buffer.alloc(32)})});}
function test(name,fn){try{fn();console.log('PASS',name)}catch(e){failed++;console.log('FAIL',name,String(e.message).slice(0,600))}}
for(const seat of [1,2]){
 const side=seat===1?'PLAYER':'AI',opp=seat===1?'AI':'PLAYER',pfx=seat===1?'player':'ai',other=seat===1?'ai':'player',defender=3-seat;
 const castFixture=()=>{
 const a=create(seat),snap=snapshot(a),s=snap.appState;s.phase='Deploy';s.turn=side;s.round=3;s.pending=null;s.responseWindow=null;s.pvpTurnReady=false;s.gameOver=false;s[other+'Hand']=[];
 for(const [i,lane] of ['LEFT','CENTER'].entries()){
 const h=s[pfx+'Heroes'][lane];Object.assign(h,{card_id:i?'S0-MAG-H004':'S0-MAG-H001',hp:100,maxHp:100,statuses:[],exhausted:true,attachments:['S0-MAG-008',null],instance_id:'caster-'+i});
 const target=s[other+'Heroes'][lane];Object.assign(target,{hp:100,maxHp:100,statuses:[],attachments:[null,null]});
 }
 s.pendingCastings=['LEFT','CENTER'].map((lane,i)=>({card_id:'S0-MAG-008',side,source_lane:lane,original_source_lane:lane,source_hero_card_id:s[pfx+'Heroes'][lane].card_id,source_instance_id:'caster-'+i,target_side:opp,target_lane:lane,locked_target_lane:lane,attachmentSlot:0,resolve_phase:'casting_progress',counters:1,required_counters:1,commit_token:'cast-'+i}));
 s.activeAttachments=['LEFT','CENTER'].map((lane,i)=>({attachment_id:'a'+i,side,lane,slot:0,card_id:'S0-MAG-008',attachment_state:'CASTING',commit_token:'cast-'+i}));
 return {a,snap,s};
 };
 test('P03 two ready casts seat '+seat,()=>{
 const {a,snap}=castFixture();a.injectFixture(snap);
 a.applyIntent(seat,'advancePhase',[]);let x=state(a);assert.equal(x.phase,'Battle');assert.equal(x.responseWindow?.target_lane,'LEFT');assert.equal(x.pendingCastings.length,1);
 captureBrowser(a,seat,'before');captureBrowser(a,defender,'before');
 const rev=a.revision;assert.throws(()=>a.applyIntent(seat,'advancePhase',[]));assert.equal(a.revision,rev);
 a.applyIntent(defender,'responsePassNoStuck',[]);x=state(a);assert.equal(a.revision,rev+1);assert.equal(x.phase,'Battle');assert.ok(x[other+'Heroes'].LEFT.hp<100);assert.equal(x.responseWindow?.target_lane,'CENTER','second response must open without next turn');assert.equal(x.responseWindow?.response_owner,opp);
 captureBrowser(a,seat,'first');captureBrowser(a,defender,'first');
 assert.equal(a.combatPresentationForSeat(seat).filter(e=>e.card_id==='S0-MAG-008').length,1,'first impact published before second Response');
 a.applyIntent(defender,'responsePassNoStuck',[]);x=state(a);assert.equal(x.phase,'Battle');assert.equal(x.pendingCastings.length,0);assert.equal(x.responseWindow,null);assert.ok(x[other+'Heroes'].CENTER.hp<100);assert.equal(x[pfx+'Heroes'].LEFT.attachments.filter(Boolean).length,0);assert.equal(x[pfx+'Heroes'].CENTER.attachments.filter(Boolean).length,0);
 const events=a.combatPresentationForSeat(seat).filter(e=>e.card_id==='S0-MAG-008');assert.equal(events.length,2,'both cast impact journals survive');assert.deepEqual(events.map(e=>e.target_lane),['LEFT','CENTER']);assert(events.every(e=>e.targets[0].damage>0));
 captureBrowser(a,seat,'second');captureBrowser(a,defender,'second');
 const committed=x.pvpRc44FeedbackEvents.filter(e=>e.feedback.kind==='attack');assert.equal(committed.length,2,'one committed feedback event per casting impact');assert.equal(new Set(committed.map(e=>e.id)).size,2);assert.deepEqual(committed.map(e=>e.feedback.lane),['LEFT','CENTER']);assert(committed.every(e=>e.feedback.hp_before===100&&e.feedback.hp_after<100));
 for(const viewer of [seat,defender]){const events=view(a,viewer).pvpRc44FeedbackEvents.filter(e=>e.feedback.kind==='attack');assert.deepEqual(events.map(e=>e.id),committed.map(e=>e.id));assert(events.every(e=>e.feedback.side===(viewer===seat?'AI':'PLAYER')));assert(events.every(e=>Object.keys(e).sort().join(',')==='feedback,id,type'&&!e.feedback.hero_view));}
 const revAfter=a.revision;assert.throws(()=>a.applyIntent(defender,'responsePassNoStuck',[]));assert.equal(a.revision,revAfter);assert.deepEqual(state(a).pvpRc44FeedbackEvents, x.pvpRc44FeedbackEvents,'rejected intent cannot publish duplicate effects');
 a.applyIntent(seat,'advancePhase',[]);assert.equal(state(a).phase,'Reform');
 });
 for(const mode of ['not ready','Sleep','Stun','locked Legacy'])test('P03 '+mode+' seat '+seat,()=>{
 const {a,snap,s}=castFixture();
 if(mode==='not ready')s.pendingCastings[1].counters=0;
 if(['Sleep','Stun'].includes(mode))s[pfx+'Heroes'].CENTER.statuses=[{name:mode,duration:2}];
 if(mode==='locked Legacy')Object.assign(s[other+'Heroes'].CENTER,{card_id:'S0-WAR-L001',mode:'LEGACY',legacy_mode:true,active_legacy_card_id:'S0-WAR-L001',hp:0});
 a.injectFixture(snap);a.applyIntent(seat,'advancePhase',[]);assert.equal(state(a).responseWindow.target_lane,'LEFT');
 a.applyIntent(defender,'responsePassNoStuck',[]);const x=state(a);assert.equal(x.responseWindow,null);assert.equal(x.pending,null);
 if(['not ready','Sleep'].includes(mode)) {assert.equal(x.pendingCastings.length,1);assert.equal(x[pfx+'Heroes'].CENTER.attachments[0],'S0-MAG-008');assert.equal(x[other+'Heroes'].CENTER.hp,100);}
 else {assert.equal(x.pendingCastings.length,0);assert.equal(x[pfx+'Heroes'].CENTER.attachments.filter(Boolean).length,0);}
 a.applyIntent(seat,'advancePhase',[]);assert.equal(state(a).phase,'Reform');
 });
 test('P03 mandatory Legacy choice before next Casting seat '+seat,()=>{
 const {a,snap,s}=castFixture();const target=s[other+'Heroes'].LEFT;
 Object.assign(target,{card_id:'S0-WAR-H001',hp:10});s[other+'Legacy'].push('S0-WAR-L001');
 a.injectFixture(snap);a.applyIntent(seat,'advancePhase',[]);a.applyIntent(defender,'responsePassNoStuck',[]);
 let x=state(a);assert.equal(x.pending?.type,'legacy_defeat_choice');assert.equal(x.responseWindow,null);assert.equal(x.pendingCastings.length,1);
 const rev=a.revision;assert.throws(()=>a.applyIntent(seat,'advancePhase',[]));assert.equal(a.revision,rev);
 a.applyIntent(defender,'commitExactLocalChoiceDraft',[{kind:'legacy_defeat_choice',choiceId:x.pending.choice_id,index:0}]);x=state(a);
 assert.equal(x.responseWindow?.target_lane,'CENTER');assert.equal(x.phase,'Battle');assert.equal(a.revision,rev+1);
 a.applyIntent(defender,'responsePassNoStuck',[]);assert.equal(state(a).responseWindow,null);assert.equal(state(a).pendingCastings.length,0);
 a.applyIntent(seat,'advancePhase',[]);assert.equal(state(a).phase,'Reform');
 });
 test('P01 all ten Legacy action metadata and server validation seat '+seat,()=>{
 const a=create(seat),base=snapshot(a);
 for(const cls of ['WAR','MAG','CLE','THF','ARC'])for(const n of ['001','002']){
 const id='S0-'+cls+'-L'+n,c=a.getCardForQA(id),snap=structuredClone(base),s=snap.appState;
 s.turn=side;s.phase='Reform';s.pending=null;s.responseWindow=null;s.pvpTurnReady=false;s.gameOver=false;s.round=3;
 s[pfx+'Heroes'].CENTER={card_id:id,side,lane:'CENTER',mode:'LEGACY',legacy_mode:true,active_legacy_card_id:id,hp:0,attachments:[null,null],statuses:[],defeated_hero_snapshot:{card_id:'S0-'+cls+'-H001',hp:0,maxHp:80,exp_cards:[],attachments:[null,null]}};
 s[pfx+'Hand']=['S0-'+cls+'-001','S0-'+cls+'-002'];s[pfx+'Deck']=['S0-WAR-001','S0-ITM-001'];s[pfx+'Discard']=['S0-ITM-001','S0-THF-001'];
 a.injectFixture(snap);const own=view(a,seat);assert.equal(own.pvpLocalLegalLegacyAbilities.CENTER[0]?.abilityId,c.ability.action_key,id);
 assert.equal(view(a,defender).pvpLocalLegalLegacyAbilities.CENTER.length,0,id+' opposite seat');
 assert(own.playerDeck.every(x=>x==='__HIDDEN_CARD_BACK__'),id+' deck must stay masked');
 a.applyIntent(seat,'beginActivatedLegacyAbility',['PLAYER','CENTER',c.ability.action_key]);
 a.applyIntent(seat,'commitExactLocalChoiceDraft',[{kind:'legacy_cost_selection',selected:[0]}]);
 if(state(a).pending?.type==='legacy_card_choice')a.applyIntent(seat,'commitExactLocalChoiceDraft',[{kind:'legacy_card_choice',selected:[0]}]);
 assert.equal(state(a).pending,null,id+' must complete');
 assert.equal(view(a,seat).pvpLocalLegalLegacyAbilities.CENTER.length,0,id+' once per turn');
 const r=a.revision;assert.throws(()=>a.applyIntent(seat,'beginActivatedLegacyAbility',['PLAYER','CENTER',c.ability.action_key]));assert.equal(a.revision,r,id+' rejected intent revision');
 }
 });
 test('P01 Arcane Wand own legality + hidden deck seat '+seat,()=>{
 const a=create(seat),snap=snapshot(a),s=snap.appState;s.turn=side;s.phase='Deploy';s.pending=null;s.responseWindow=null;s.pvpTurnReady=false;s.gameOver=false;s.round=3;
 s[pfx+'Heroes'].CENTER={card_id:'S0-MAG-L002',side,lane:'CENTER',mode:'LEGACY',legacy_mode:true,active_legacy_card_id:'S0-MAG-L002',hp:0,attachments:[null,null],statuses:[],defeated_hero_snapshot:{card_id:'S0-MAG-H001',hp:0,maxHp:80,exp_cards:[],attachments:[null,null]}};
 s[pfx+'Hand']=['S0-MAG-001','S0-MAG-002'];s[pfx+'Deck']=['S0-WAR-001','S0-ITM-001'];
 a.injectFixture(snap);const own=view(a,seat),enemy=view(a,defender);
 assert(own.playerDeck.every(x=>x==='__HIDDEN_CARD_BACK__'));assert(enemy.aiDeck.every(x=>x==='__HIDDEN_CARD_BACK__'));
 assert.equal(own.pvpLocalLegalLegacyAbilities?.CENTER?.[0]?.abilityId,'arcane_wand');assert.equal(enemy.pvpLocalLegalLegacyAbilities?.CENTER?.length,0);assert.equal(state(a).pvpLocalLegalLegacyAbilities,undefined);
 a.applyIntent(seat,'beginActivatedLegacyAbility',['PLAYER','CENTER','arcane_wand']);assert.equal(state(a).pending?.type,'legacy_cost_selection');
 const bad=structuredClone(snap);bad.appState[pfx+'Deck']=['S0-ITM-001'];a.injectFixture(bad);
 assert.equal(view(a,seat).pvpLocalLegalLegacyAbilities.CENTER.length,0,'no skill in real deck');
 const revision=a.revision;assert.throws(()=>a.applyIntent(seat,'beginActivatedLegacyAbility',['PLAYER','CENTER','arcane_wand']));assert.equal(a.revision,revision);
 });
}
if(process.env.GL_RC44_BROWSER_FIXTURES)writeFileSync(process.env.GL_RC44_BROWSER_FIXTURES,JSON.stringify(browserFixtures));
process.exitCode=failed?1:0;
