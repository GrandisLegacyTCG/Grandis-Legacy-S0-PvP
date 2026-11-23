'use strict';
/* Grandis Legacy Season0 RC42 R3.98/R4.0 targeted engine tests. 2026-11-23.
   This suite runs the REAL app engine in Node VM; it is not a browser E2E.
   Printed artwork integrity checks are handled by the neighboring Python QA. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'../../public/battle');
const cx={console,URL,Date,Math,Array,JSON,Map,Set,Promise,Uint8Array,TextDecoder,TextEncoder,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},requestAnimationFrame:()=>0,cancelAnimationFrame(){},crypto:crypto.webcrypto};
cx.window=cx;cx.globalThis=cx;cx.location={href:'file:///index.html',origin:'file://'};cx.navigator={userAgent:'RC42-R398 Node VM'};cx.document={readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null},querySelectorAll(){return []},createElement(){return {style:{},appendChild(){},setAttribute(){}}},documentElement:{classList:{toggle(){}}},body:{appendChild(){}}};
vm.createContext(cx);
for(const file of ['engine/js/static-data.js','assets/review-db158/js/db166-view-model.js','engine/js/runtime-authority.js','engine/shared-app/active-starters.js','runtime/season0-generated/rc41-approved-print-overrides.js','runtime/season0-generated/rc42-main-deck-r398-overlay.js','engine/shared-app/app.bundle.js']){
 let src=fs.readFileSync(path.join(root,file),'utf8');
 if(file.endsWith('app.bundle.js')){src=src.replace('function showInfo(title, body){','function showInfo(title, body){if(SUPPRESS_RENDER)return;');src=src.replace(/\n\}\)\(\);\s*$/,`\nwindow.__TEST={initCards,card,heroState,buildInitialMatchState,commitPlayedCard,executeAIAction,getLegalActions,get state(){return appState},setState:s=>{appState=s;matchStarted=true;SUPPRESS_RENDER=true},responseOptionsFor,responseBlockAmount,consumeS0DiscardCondition,drawMany,gainMana,manaPoolCardsForSide,firstDrawCount,heroClass,sourceCompatibleForResponse,sourceCompatibleForMode,legalPlayStateFor,validateCardPreconditions,validateAction,fullFor,thumbFor,previewManaRows,getCards:()=>CARD_BY_ID,legalTargetLanesFor,legalSourceLanesFor,attackHasRangeForSource,applySourcePostAttackEffects,applyAttackStatuses,resolveResponseWindow,requiredDiscardSpecificIds,handHasRequiredDiscards,discardConditionSpec,discardConditionCanPay,conditionDrawCanPay,mandatoryConditionDrawCount,consumeHandConditionDraw,sourceCompatible,heroMatchesLineageGate,cardSubtype,runtimeTagList,attackCannotBeDodged,attackType,isAreaAttack,computedAttackDamageForAction,printedClassDamage,cardPlayCostForSource,applyNonAttackStatuses};\n})();`);
 }
 vm.runInContext(src,cx,{filename:file,timeout:60000});
}
const q=cx.__TEST;q.initCards();let count=0,passed=0,failed=[];
function test(name,fn){count++;try{fn();console.log('PASS '+name);passed++;}catch(e){console.error('FAIL '+name+'\n '+String(e.stack||e));failed.push({name,error:String(e.stack||e).slice(0,1500)});}}
function eq(a,b,msg){assert.strictEqual(a,b,msg);}
function fresh(side='PLAYER',phase='Battle'){
 let s=q.buildInitialMatchState();q.setState(s);s.preGame=null;s.turn=side;s.phase=phase;s.round=2;
 s.mana=30;s.aiMana=30;s.playerHand=[];s.aiHand=[];s.playerDiscard=[];s.aiDiscard=[];
 q.gainMana(s,'PLAYER',9);q.gainMana(s,'AI',9);return s;
}
function hero(s,side,lane,id){let h=(side==='PLAYER'?s.playerHeroes:s.aiHeroes)[lane];h.card_id=id;h.hp=100;h.maxHp=100;h.exhausted=false;h.statuses=[];h.attachments=[null,null];return h}
function allIds(){return Object.keys(q.getCards()).filter(id=>/S0-(?:ARC|CLE|MAG|THF|WAR|EVT|ITM)-\d{3}$/.test(id));}
const expected={
'S0-ARC-008':{cost:5,damage:[50,60]},'S0-ARC-010':{cost:0,damage:[10]},'S0-ARC-020':{cost:5,damage:[50,60]},
'S0-CLE-014':{cost:8,damage:[70,90],type:'Magical Attack'},'S0-CLE-020':{cost:5,damage:[50]},
'S0-MAG-008':{cost:5,damage:[60,80]},'S0-MAG-017':{cost:7,damage:[60,80]},'S0-MAG-020':{cost:4,damage:[50,70]},
'S0-MAG-021':{cost:5,damage:[50,50]},'S0-MAG-026':{cost:4,damage:[40,50]},
'S0-THF-009':{cost:3,damage:[80]},'S0-THF-010':{cost:5,damage:[60,60]},'S0-THF-013':{cost:4,damage:[30,40]},
'S0-THF-022':{cost:3,damage:[-60]},'S0-THF-023':{cost:3,damage:[],name:'Flash Switch'},
'S0-THF-024':{cost:7,damage:[50,70]},'S0-THF-026':{cost:4,damage:[30,40]},
'S0-WAR-022':{cost:6,damage:[70]},'S0-WAR-026':{cost:5,damage:[60]}
};
test('244 canonical Hero/Legacy/Main cards, 189 Main cards',()=>{eq(Object.keys(q.getCards()).length,244);eq(allIds().length,189)});
test('19 updated print definitions: class row values, Mana Cost, full ID preservation',()=>{
 eq(Object.keys(expected).length,19);
 for(const [id,props] of Object.entries(expected)){
  const c=q.card(id);eq(c.card_id,id);eq(c.cost_mana,props.cost,`${id}: mana`);
  const dmg=(c.printed.rows||[]).map(r=>Number(r.damage)).filter(x=>x!==0);
  eq(JSON.stringify(dmg),JSON.stringify(props.damage),`${id}: printed damage rows`);
  if(props.type)eq(c.classification,props.type,id+': classification');
  if(props.name)eq(c.name,props.name,id+': name');
 }
});
test('Active Review DB + Preview registry renamed Flash Switch and corrected subtype',()=>{
 let c=cx.GL_DB166_REVIEW_CARDS['S0-THF-023'];eq(c.name,'Flash Switch');
 eq(cx.GRANDIS_LEGACY_CARD_PREVIEW.cards.find(c=>c.card_id==='S0-THF-023').name,'Flash Switch');
 eq(cx.GL_DB166_REVIEW_CARDS['S0-CLE-014'].classification,'Magical Attack');
 eq(cx.GRANDIS_LEGACY_CARD_PREVIEW.cards.find(c=>c.card_id==='S0-CLE-014').classification,'Magical Attack');
});
test('Artwork manifest tracks all 244 (189 Main + 55 Legacy) source identities',()=>{
 eq(Object.keys(cx.GL_RC42_MAIN_CARD_ASSETS).length,244);
 eq(Object.keys(cx.GL_ASSET_MANIFEST.cards).length,250);
 eq(cx.GL_ASSET_MANIFEST.artwork_source,'Main Deck R3.98 / Legacy Deck R4.0');
 for(const id of Object.keys(cx.GL_RC42_MAIN_CARD_ASSETS)){
  const raw=fs.readFileSync(path.join(root,'card-art',id+'.webp'));
  eq(crypto.createHash('sha256').update(raw).digest('hex'),cx.GL_RC42_MAIN_CARD_ASSETS[id],id+' art SHA');
  eq(cx.GL_ASSET_MANIFEST.cards[id].sha256,cx.GL_RC42_MAIN_CARD_ASSETS[id],id+' manifest SHA');
 }
});
test('Wrathful is single-target Magical; no Area targeting; Priest/Stun1 and Saint/Stun1',()=>{
 const c=q.card('S0-CLE-014');eq(q.attackType(c),'Single Target');assert(!q.isAreaAttack(c));
 const status=c.effect.find(x=>x.kind==='inflict_status'&&x.status==='Stun');assert(status,'missing Stun effect');
 eq(status.duration_by_class.Priest,1);eq(status.duration_by_class.Saint,1);
 eq(c.attack.damage_by_class.Priest,70);eq(c.attack.damage_by_class.Saint,90);
});
test('Deflection only Spell Blade lineage Rank II+, -60 BLOCK both damage types, no REFLECT',()=>{
 let c=q.card('S0-THF-022');eq(c.printed.rows.length,1);
 eq(c.printed.rows[0].label,'Spell Blade (Rank II)');
 assert(!/REFLECT/i.test(c.card_text+' '+JSON.stringify(c.effect)+' '+q.runtimeTagList(c).join(' ')));
 for(let t of ['Physical','Magical'])eq(q.responseBlockAmount(c,{damage_type:t,cannot_block:false},{card_id:'S0-THF-H008',hp:100,exhausted:false}),60);
 eq(q.sourceCompatibleForResponse(c,{card_id:'S0-THF-H001',hp:100,exhausted:false,attachments:[null,null]}),false);
 eq(q.sourceCompatibleForResponse(c,{card_id:'S0-THF-H002',hp:100,exhausted:false,attachments:[null,null]}),false);
 eq(q.sourceCompatibleForResponse(c,{card_id:'S0-THF-H008',hp:100,exhausted:false,attachments:[null,null]}),true);
});
test('Removed Warrior rank-I rows: Sacred Stormblade/Skull Crush legal only eligible rank-II lineages',()=>{
 const pal=q.card('S0-WAR-022'),arc=q.card('S0-WAR-026');
 for(let c of [pal,arc])eq(q.sourceCompatibleForMode(c,{card_id:'S0-WAR-H001',hp:100,exhausted:false,attachments:[null,null]}),false);
 assert(q.sourceCompatibleForMode(pal,{card_id:'S0-WAR-H008',hp:100,exhausted:false,attachments:[null,null]}));
 assert(q.sourceCompatibleForMode(arc,{card_id:'S0-MAG-H008',hp:100,exhausted:false,attachments:[null,null]}));
 eq(q.sourceCompatibleForMode(arc,{card_id:'S0-WAR-H008',hp:100,exhausted:false,attachments:[null,null]}),false);
});
test('Back Slash Thief Rank I is blockable/dodgeable, Rogue Rank II cannot Dodge',()=>{
 const c=q.card('S0-THF-010');
 eq(q.attackCannotBeDodged(c,{card_id:'S0-THF-H001',hp:100}),false);
 eq(q.attackCannotBeDodged(c,{card_id:'S0-THF-H002',hp:100}),true);
 eq(c.attack.damage_by_class.Thief,60);eq(c.attack.damage_by_class.Rogue,60);
});
test('Universal MELEE wins over RANGE granted by later Class',()=>{
 for(const id of ['S0-ARC-H001','S0-ARC-H002','S0-ARC-H003']){
  const c=q.card('S0-ARC-001'),h={card_id:id,hp:100,exhausted:false};
  eq(q.attackHasRangeForSource(c,h),false,id+' MELEE');
 }
 for(const id of ['S0-THF-H001','S0-THF-H002'])eq(q.attackHasRangeForSource(q.card('S0-THF-010'),{card_id:id,hp:100}),false);
});
test('Area and MELEE targeting matrix enforces opposite lane only regardless of target range',()=>{
 let s=fresh('PLAYER');let cc=q.card('S0-ARC-001');
 hero(s,'PLAYER','LEFT','S0-ARC-H003');hero(s,'PLAYER','CENTER','S0-ARC-H003');hero(s,'PLAYER','RIGHT','S0-ARC-H003');
 for(let lane of ['LEFT','CENTER','RIGHT']){
  let targets=q.legalTargetLanesFor(s,'PLAYER',cc.card_id,lane);
  eq(targets.join(','),lane,`${lane} should be opposite only; actual ${targets.join(',')}`);
 }
 s.aiHeroes.CENTER.hp=0;
 eq(q.legalTargetLanesFor(s,'PLAYER',cc.card_id,'CENTER').length,0);
});
test('Mana Burn 2 Arcane Warrior new printed effect; other Mage row unaffected',()=>{
 const c=q.card('S0-MAG-026');
 assert(/MANA BURN 2/.test(c.effect_strings_by_class['Arcane Warrior']));
 assert(!/MANA BURN/.test(c.effect_strings_by_class.Mage));
 let s=fresh();const h=hero(s,'PLAYER','CENTER','S0-MAG-H008');
 const r={primary_hp_damage:0,connected:true,connected_hits:1};
 q.applySourcePostAttackEffects(s,c.card_id,h,'PLAYER','CENTER','AI','CENTER',r);
 eq(r.mana_interactions?.[0]?.amount,2);
});
test('X Cross Slash and Bard cards: CONDITION count detected; effect Draw kept separate',()=>{
 for(const [id,num] of [['S0-THF-009',2],['S0-ARC-028',1],['S0-CLE-030',2],['S0-CLE-031',3]])eq(q.mandatoryConditionDrawCount(q.card(id)),num,id);
 eq(q.mandatoryConditionDrawCount(q.card('S0-CLE-013')),0);
 eq(q.firstDrawCount(q.card('S0-CLE-013')),3);
});
for(const n of [0,1,2,3])test('X Cross precommit requires deck >=2 for '+n+' available cards, both players',()=>{
 let s=fresh();s.playerHand=['S0-THF-009','S0-THF-007','S0-THF-008'];s.aiHand=s.playerHand.slice();s.playerDeck=Array(n).fill('S0-WAR-001');s.aiDeck=s.playerDeck.slice();
 const p=q.validateCardPreconditions(s,'PLAYER','S0-THF-009','CENTER','CENTER'),a=q.validateCardPreconditions(s,'AI','S0-THF-009','CENTER','CENTER');
 eq(p.ok,n>=2);eq(a.ok,n>=2);
});
test('X Cross no legal action with one deck card and no resource payments',()=>{
 let s=fresh('AI');s.aiHand=['S0-THF-009','S0-THF-007','S0-THF-008'];s.aiDeck=['S0-WAR-001'];hero(s,'AI','CENTER','S0-THF-H002');
 let before=JSON.stringify({hand:s.aiHand,deck:s.aiDeck,discard:s.aiDiscard,mana:s.aiMana,exhausted:s.aiHeroes.CENTER.exhausted});
 let act={type:'PLAY_CARD',side:'AI',card_id:'S0-THF-009',hand_index:0,source_side:'AI',source_lane:'CENTER',target_side:'PLAYER',target_lane:'CENTER'};
 eq(q.validateAction(s,'AI',act).ok,false);
 eq(q.commitPlayedCard(s,act),false);
 let after=JSON.stringify({hand:s.aiHand,deck:s.aiDeck,discard:s.aiDiscard,mana:s.aiMana,exhausted:s.aiHeroes.CENTER.exhausted});
 eq(before,after,'invalid CONDITION altered physical game state');
});
test('X Cross Draw2 physically completes before Response, discards exactly two required Skills',()=>{
 let s=fresh('AI');s.aiHand=['S0-THF-009','S0-THF-007','S0-THF-008'];s.aiDeck=['S0-WAR-001','S0-WAR-002'];
 hero(s,'AI','CENTER','S0-THF-H002');
 let action={type:'PLAY_CARD',side:'AI',card_id:'S0-THF-009',hand_index:0,source_side:'AI',source_lane:'CENTER',target_side:'PLAYER',target_lane:'CENTER'};
 let before=s.aiMana;
 assert(q.validateAction(s,'AI',action).ok);
 assert(q.commitPlayedCard(s,action));
 assert(s.aiHand.includes('S0-WAR-001')&&s.aiHand.includes('S0-WAR-002'),`Draw must finish before response: ${JSON.stringify(s.aiHand)}`);
 assert(!s.aiHand.includes('S0-THF-007')&&!s.aiHand.includes('S0-THF-008'));
 eq(s.aiDeck.length,0);eq(s.aiDiscard.filter(id=>/S0-THF-00[78]/.test(id)).length,2);
 assert(s.responseWindow,'No Response opened following CONDITION');
 assert(s.aiMana<=before);
});
test('Midnight Lullaby Draw1 from previously empty deck after returning notes',()=>{
 let s=fresh();s.playerDeck=[];s.playerDiscard=['S0-ARC-026','S0-CLE-026'];
 const c=q.card('S0-ARC-028');assert(q.conditionDrawCanPay(s,'PLAYER',c));
 let action={s0_discard_condition_picks:[{discard_index:0,card_id:'S0-ARC-026'},{discard_index:1,card_id:'S0-CLE-026'}]};
 eq(q.consumeS0DiscardCondition(s,'PLAYER',c,action),2);
 eq(action.s0_condition_draw_count,1);eq(s.playerHand.length,1);eq(s.playerDeck.length,1);
});
test('Blooming Harmony Draw2 from previously empty deck after returning Lun + Vae',()=>{
 let s=fresh();s.playerDeck=[];s.playerDiscard=['S0-CLE-026','S0-CLE-027'];
 const c=q.card('S0-CLE-030');assert(q.conditionDrawCanPay(s,'PLAYER',c));
 let action={s0_discard_condition_picks:[{discard_index:0,card_id:'S0-CLE-026'},{discard_index:1,card_id:'S0-CLE-027'}]};
 q.consumeS0DiscardCondition(s,'PLAYER',c,action);
 eq(action.s0_condition_draw_count,2);eq(s.playerDeck.length,0);eq(s.playerHand.length,2);
});
test('Grand Finale Draw3 resolves as mandatory CONDITION before attack from empty deck',()=>{
 let s=fresh();s.playerDeck=[];s.playerDiscard=['S0-ARC-026','S0-CLE-026','S0-CLE-027'];
 const c=q.card('S0-CLE-031');assert(q.conditionDrawCanPay(s,'PLAYER',c));
 let action={s0_discard_condition_picks:[{discard_index:0,card_id:'S0-ARC-026'},{discard_index:1,card_id:'S0-CLE-026'},{discard_index:2,card_id:'S0-CLE-027'}]};
 q.consumeS0DiscardCondition(s,'PLAYER',c,action);
 eq(action.s0_condition_draw_count,3);eq(s.playerDeck.length,0);eq(s.playerHand.length,3);
});
test('Effect Draw allows partial and zero draws even with missing full amount',()=>{
 let s=fresh();s.playerDeck=['S0-WAR-001'];q.drawMany(s,'PLAYER',3,{reason:'CARD_EFFECT'});eq(s.playerHand.length,1);eq(s.playerDeck.length,0);
 q.drawMany(s,'PLAYER',3,{reason:'CARD_EFFECT'});eq(s.playerHand.length,1);
});
test('Arrow Barrage max printed 80, vs 12 Mana Cards, not max 90',()=>{
 const c=q.card('S0-ARC-010');assert(/Max 80 damage/i.test(c.card_text));
 let s=fresh();let atk=hero(s,'PLAYER','CENTER','S0-ARC-H002'),tgt=hero(s,'AI','CENTER','S0-WAR-H001');
 let action={card_id:c.card_id,source_side:'PLAYER',source_lane:'CENTER',target_side:'AI',target_lane:'CENTER',mana_cards_spent:12};
 let damage=q.computedAttackDamageForAction(s,action,atk,tgt);eq(damage,80,action.damage_formula_log);
});
// Defense Item permissions must be local to the protected target of each window.
function incoming(lane,type='Physical',source='CENTER'){return {card_id:'S0-WAR-001',source_side:'PLAYER',source_lane:source,target_side:'AI',target_lane:lane,damage:40,damage_type:type,attack_type:'Single Target',cannot_block:false,cannot_dodge:false};}
test('Spectral Hook cannot protect Mage while team has eligible Archer/Thief',()=>{
 let s=fresh('PLAYER');s.aiHand=['S0-ITM-012','S0-WAR-001'];
 hero(s,'AI','LEFT','S0-ARC-H001');hero(s,'AI','CENTER','S0-MAG-H001');hero(s,'AI','RIGHT','S0-THF-H001');
 eq(q.responseOptionsFor(s,'AI',incoming('CENTER')).filter(x=>x.card_id==='S0-ITM-012').length,0);
 assert(q.responseOptionsFor(s,'AI',incoming('LEFT')).some(x=>x.card_id==='S0-ITM-012'));
 assert(q.responseOptionsFor(s,'AI',incoming('RIGHT')).some(x=>x.card_id==='S0-ITM-012'));
});
test('Chain Mail cannot protect Mage when team includes Warrior',()=>{
 let s=fresh('PLAYER');s.aiHand=['S0-ITM-016'];
 hero(s,'AI','LEFT','S0-WAR-H001');hero(s,'AI','CENTER','S0-MAG-H001');hero(s,'AI','RIGHT','S0-CLE-H001');
 eq(q.responseOptionsFor(s,'AI',incoming('CENTER')).filter(x=>x.card_id==='S0-ITM-016').length,0);
 assert(q.responseOptionsFor(s,'AI',incoming('LEFT')).some(x=>x.card_id==='S0-ITM-016'));
});
test('Ring Protection available to Mage and other all-Class Heroes for Magical response',()=>{
 let s=fresh('PLAYER');s.aiHand=['S0-ITM-007'];hero(s,'AI','CENTER','S0-MAG-H001');
 assert(q.responseOptionsFor(s,'AI',incoming('CENTER','Magical')).some(x=>x.card_id==='S0-ITM-007'));
});
test('Legacy Rank Hero new artwork is image-only: stable base Hero metadata',()=>{
 for(let n=1;n<=9;n++){let id=`S0-THF-H${String(n).padStart(3,'0')}`;assert(q.card(id).family==='Hero');}
 for(let n=1;n<=2;n++){let id=`S0-THF-L${String(n).padStart(3,'0')}`;assert(q.card(id).family==='Legacy');}
});
let result={suite:'RC42_R398_R40_REGRESSION',mode:'REAL_ENGINE_NODE_VM_NO_BROWSER',executed:count,passed,failed:failed.length,failures:failed,date:'2026-11-23'};
const dest=path.resolve(__dirname,'../../docs/qa/CURRENT_RC42_R398_R40_RESULTS.json');fs.writeFileSync(dest,JSON.stringify(result,null,2));
console.log('\nR3.98/R4.0 NODE VM QA:',passed,'/',count,'FAILURES',failed.length);if(failed.length)process.exitCode=1;
