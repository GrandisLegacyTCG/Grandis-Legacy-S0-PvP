'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const root=path.resolve(__dirname,'../../public/battle');
const cx={console,URL,Date,Math,Array,JSON,Map,Set,Promise,Uint8Array,TextDecoder,TextEncoder,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},requestAnimationFrame:()=>0,cancelAnimationFrame(){},crypto:crypto.webcrypto};
cx.window=cx;cx.globalThis=cx;cx.location={href:'file:///index.html',origin:'file://'};cx.navigator={userAgent:'RC42 VM'};cx.document={readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null},querySelectorAll(){return []},createElement(){return {style:{},appendChild(){},setAttribute(){}}},documentElement:{classList:{toggle(){}}},body:{appendChild(){}}};
vm.createContext(cx);
const base=['engine/js/static-data.js','assets/review-db158/js/db166-view-model.js','engine/js/runtime-authority.js','engine/shared-app/active-starters.js','runtime/season0-generated/rc41-approved-print-overrides.js','runtime/season0-generated/rc42-main-deck-r398-overlay.js','engine/shared-app/app.bundle.js'];
for(const file of base){let src=fs.readFileSync(path.join(root,file),'utf8');if(file.endsWith('app.bundle.js'))src=src.replace(/\n\}\)\(\);\s*$/, '\nwindow.__RC42_TEST={initCards,card,heroState,buildInitialMatchState,commitPlayedCard,executeAIAction,getLegalActions,get state(){return appState},setState:s=>{appState=s;matchStarted=true;SUPPRESS_RENDER=true},sourceSwapOptions,soulBlastTargetSwapOptions,promptOptionalTargetSwap,performOptionalTargetSwapDecision,performOptionalSwapDecision,isMandatorySourceSwapCard,cardEffectSwapModel,responseOptionsFor,responseBlockAmount,lunMayBlockForHero,applySourcePostAttackEffects,applyNonAttackStatuses,consumeS0DiscardCondition,drawMany,gainMana,manaPoolCardsForSide,cardPlayCostForSource,firstDrawCount,heroClass,skillEffectSwapPairEligible,applyResolvedAttackDamage,resolveResponseWindow,addPrintedNamedCardFromDeck,applyImmediateEventItemEffects,applyAttackStatuses,adjacentLanes,positionLockedOneVsOne,recordAttackCardSwapResult,aiIntermediateDrawTwoPermitted,aiS4DrawAmount,aiAuraMainDeckDrawAmount,legalPlayStateFor,validateCardPreconditions,cardSubtype,runtimeTagList,isResponseOnly,requiresSourceHero,legalSourceLanesFor,manaAvailableValueForCard,responseDisplayItemsFor,responseKind,sourceCompatibleForResponse,validateAction,fullFor,thumbFor,previewManaRows,getCards:()=>CARD_BY_ID};\n})();');vm.runInContext(src,cx,{filename:file,timeout:60000})}
const q=cx.__RC42_TEST;q.initCards();
let cases=0,success=0;
function run(title,fn){cases++;try{fn();console.log('PASS',title);success++;}catch(e){console.error('FAIL',title,e.stack||String(e));process.exitCode=1}}
function fresh(side='PLAYER'){let s=q.buildInitialMatchState();q.setState(s);s.preGame=null;s.turn=side;s.phase='Deploy';s.round=2;s.mana=30;s.aiMana=30;s.playerHand=[];s.aiHand=[];q.gainMana(s,'PLAYER',8);q.gainMana(s,'AI',8);return s}
function hand(s,side){return side==='AI'?s.aiHand:s.playerHand}
function hp(s,side,lane){return (side==='AI'?s.aiHeroes:s.playerHeroes)[lane]}
function eq(a,b,msg){assert.strictEqual(a,b,msg)}
const snap=JSON.parse(JSON.stringify(cx.GL_ACTIVE_STARTER_DECKS));
run('244 runtime cards including 2 new',()=>eq(Object.keys(q.getCards()).length,244));
run('244 active cards plus 6 mana artworks; new cards visible',()=>{
  eq(cx.GL_ASSET_MANIFEST.counts.cards,244);
  eq(cx.GL_ASSET_MANIFEST.counts.mana_faces,6);
  eq(Object.keys(cx.GL_ASSET_MANIFEST.cards).length,250);
  for(const id of ['S0-EVT-013','S0-ITM-021','S0-ARC-016','S0-CLE-026']){
    assert(q.fullFor(id).startsWith('card-art/'+id+'.webp?'),q.fullFor(id));
    assert(q.thumbFor(id).startsWith('card-art/'+id+'.webp?'),q.thumbFor(id));
    const bytes=fs.readFileSync(path.join(root,'card-art/'+id+'.webp'));
    eq(cx.GL_ASSET_MANIFEST.cards[id].sha256,crypto.createHash('sha256').update(bytes).digest('hex'));
  }
});
run('Canonical preview registry exposes R3.94 text and costs',()=>{
  const cp=cx.GRANDIS_LEGACY_CARD_PREVIEW.cards;
  eq(cp.length,244);
  for(const [id,cost] of [['S0-ARC-028',6],['S0-CLE-029',3],['S0-EVT-013',3],['S0-ITM-021',0]]){
    const rec=cp.find(x=>x.card_id===id);assert(rec,'missing canonical preview '+id);eq(rec.cost.mana,cost);
    eq(q.previewManaRows(q.card(id))[0].value,String(cost));
  }
  assert(cp.find(x=>x.card_id==='S0-THF-024').printed.text.includes('in front of the attacked Hero'));
});
run('Review database includes 2 new cards and revised text',()=>{
  const db=cx.GL_DB166_REVIEW_CARDS||{};
  for(const id of ['S0-EVT-013','S0-ITM-021'])assert(db[id]&&db[id].image==='card-art/'+id+'.webp','Missing review '+id);
  assert(db['S0-ARC-016'].text.includes('you may swap'),'Soul review stale');
  assert(db['S0-CLE-029'].text.includes('Add 3 cards'),'Tune Up review stale');
});
run('all 5 starter decks 50/12/12, exact order',()=>{eq(Object.keys(snap).length,5);eq(snap.s0_starter_02_yellow_blue.deck.deck_name,'Yellow-Blue Deck');eq(snap.s0_starter_03_red_white.deck.deck_name,'Red-White Deck');for(const k in snap){const d=snap[k].deck;eq(d.main_deck.reduce((v,e)=>v+e.quantity,0),50);eq(d.mana_deck.reduce((v,e)=>v+e.quantity,0),12);eq(d.legacy_deck_package_slots.length,3)}});
run('Soul Blast Shot R3.94 optional print',()=>{const c=q.card('S0-ARC-016');assert(c.card_text.includes('you may swap'));eq(c.cost_mana,6)});
run('Flash Slash rank II mandatory, III optional',()=>{const c=q.card('S0-THF-024');const a={card_id:'S0-THF-H008'},b={card_id:'S0-THF-H009'};console.log('  classes',q.heroClass(a),q.heroClass(b));assert(c.card_text.includes('Swap this Hero'));eq(q.isMandatorySourceSwapCard(c,a),true);eq(q.isMandatorySourceSwapCard(c,b),false)});
run('Shadow Switch allows no adjacent follow-up DODGE',()=>{const c=q.card('S0-THF-023');assert(c.card_text.includes('If possible'));assert(c.effect.some(e=>e.kind==='dodge_incoming_damage'))});
run('Lun blocks either damage type: Cleric 30',()=>{const c=q.card('S0-CLE-026'),hero={card_id:'S0-CLE-H007',hp:100};for(const d of ['Physical','Magical']){eq(q.lunMayBlockForHero(c,{damage_type:d},hero),true);eq(q.responseBlockAmount(c,{damage_type:d,cannot_block:false},hero),30)}});
run('Lun blocks either damage type: Bard 40',()=>{const c=q.card('S0-CLE-026'),hero={card_id:'S0-CLE-H008',hp:100};for(const d of ['Physical','Magical']){eq(q.responseBlockAmount(c,{damage_type:d,cannot_block:false},hero),40)}});
run('Midnight Lullaby cost 6 damage 30, no stale post draw 2',()=>{const c=q.card('S0-ARC-028');eq(c.cost_mana,6);eq(c.attack.damage_by_class.Bard,30);assert(!c.card_text.includes('then draw 2'))});
run('Crimson Crescendo Bard 30 Maestro 40',()=>{const c=q.card('S0-ARC-030');eq(c.attack.damage_by_class.Bard,30);eq(c.attack.damage_by_class.Maestro,40)});
run('Divine Judgement printed heal on damage, not Stun',()=>{const c=q.card('S0-CLE-024');assert(c.card_text.includes('HEAL this Hero'));assert(!c.card_text.includes('Stun'));assert(!c.effect.some(e=>e.kind==='inflict_status'&&e.status==='Stun'))});
run('Divine Judgement 30 self heal only on HP damage',()=>{let s=fresh();let h=hp(s,'PLAYER','CENTER');h.card_id='S0-CLE-H005';h.hp=50;h.maxHp=140;let result={primary_hp_damage:30,connected:true,connected_hits:1};q.applySourcePostAttackEffects(s,'S0-CLE-024',h,'PLAYER','CENTER','AI','CENTER',result);eq(h.hp,90);h.hp=50;let blocked={primary_hp_damage:0,connected:true,connected_hits:1};q.applySourcePostAttackEffects(s,'S0-CLE-024',h,'PLAYER','CENTER','AI','CENTER',blocked);eq(h.hp,50)});
run('Aether Ball Spell Blade on hit Mana Burn 3',()=>{let s=fresh();const r={primary_hp_damage:0,connected:true,connected_hits:1};let h=hp(s,'PLAYER','CENTER');h.card_id='S0-THF-H008';q.applySourcePostAttackEffects(s,'S0-MAG-020',h,'PLAYER','CENTER','AI','CENTER',r);eq(r.mana_interactions?.[0]?.amount,3)});
run('Mana Absorption Mage I Mana Steal 1 on hit',()=>{let s=fresh();const r={primary_hp_damage:0,connected:true,connected_hits:1};let h=hp(s,'PLAYER','CENTER');h.card_id='S0-MAG-H001';q.applySourcePostAttackEffects(s,'S0-MAG-021',h,'PLAYER','CENTER','AI','CENTER',r);eq(r.mana_interactions?.[0]?.amount,1);eq(r.mana_interactions?.[0]?.mode,'REMOVE_AND_GAIN_OWN')});
run('Mana Absorption Spell Blade II Mana Steal 2',()=>{let s=fresh();const r={connected:true,connected_hits:1};let h=hp(s,'PLAYER','CENTER');h.card_id='S0-THF-H008';q.applySourcePostAttackEffects(s,'S0-MAG-021',h,'PLAYER','CENTER','AI','CENTER',r);eq(r.mana_interactions?.[0]?.amount,2)});
run('Aether Slash tier 3 and 5 on hit',()=>{for(const [id,n] of [['S0-THF-H008',3],['S0-THF-H009',5]]){let s=fresh();let h=hp(s,'PLAYER','CENTER');h.card_id=id;const r={connected_hits:1,connected:true};q.applySourcePostAttackEffects(s,'S0-MAG-023',h,'PLAYER','CENTER','AI','CENTER',r);eq(r.mana_interactions?.[0]?.amount,n)}});
run('Aether Sweep per connected opponent 1/2',()=>{for(const [id,n] of [['S0-THF-H008',2],['S0-THF-H009',4]]){let s=fresh();let h=hp(s,'PLAYER','CENTER');h.card_id=id;const r={connected_hits:2,connected:true};q.applySourcePostAttackEffects(s,'S0-MAG-024',h,'PLAYER','CENTER','AI',null,r);eq(r.mana_interactions?.[0]?.amount,n)}});
run('Aether Infusion printed BURN 3',()=>{const c=q.card('S0-MAG-022');assert(c.card_text.includes('MANA BURN 3'))});
run('Fire Flask item inflicts Burn 2 on enemy',()=>{const c=q.card('S0-ITM-021'),s=fresh(),t=hp(s,'AI','CENTER');t.hp=100;t.statuses=[];eq(c.family,'Item');const statuses=q.applyNonAttackStatuses(c,t,hp(s,'PLAYER','CENTER'),'PLAYER');assert(statuses.some(x=>x.includes('Burn 2')),JSON.stringify(statuses))});
run('Cheers! Event shuffles whole remaining hand and Draws opponent count',()=>{let s=fresh();s.playerHand=['S0-MAG-005','S0-ARC-001'];s.aiHand=['S0-CLE-001','S0-THF-001','S0-WAR-001'];s.playerDeck=['S0-MAG-001','S0-MAG-002','S0-MAG-003','S0-MAG-004'];let old=s.playerDeck.length;q.applyImmediateEventItemEffects(s,'PLAYER',q.card('S0-EVT-013'),null,null,null,{});eq(s.playerHand.length,3);eq(s.playerDeck.length,old+2-3);eq(s.aiHand.length,3)});
run('Cheers! empty opposing hand produces 0 Draw',()=>{let s=fresh();s.aiHand=[];s.playerHand=['S0-MAG-005'];s.playerDeck=['S0-MAG-001'];q.applyImmediateEventItemEffects(s,'PLAYER',q.card('S0-EVT-013'),null,null,null,{});eq(s.playerHand.length,0);eq(s.playerDeck.length,2)});
run('Swift Movement searches Vae, not Draw',()=>{let s=fresh();s.playerHand=[];s.playerDeck=['S0-CLE-027','S0-MAG-001'];q.addPrintedNamedCardFromDeck(s,'PLAYER',q.card('S0-ARC-029'),'S0-CLE-027');eq(s.playerHand[0],'S0-CLE-027');eq(s.playerDeck.length,1);eq(q.firstDrawCount(q.card('S0-ARC-029')),0)});
run('Blessing of Accuracy searches Zol, not Draw',()=>{let s=fresh();s.playerHand=[];s.playerDeck=['S0-ARC-026','S0-MAG-001'];q.addPrintedNamedCardFromDeck(s,'PLAYER',q.card('S0-CLE-028'),'S0-ARC-026');eq(s.playerHand[0],'S0-ARC-026');eq(q.firstDrawCount(q.card('S0-CLE-028')),0)});
run('Tune Up cost 3 search 3 printed',()=>{const c=q.card('S0-CLE-029');eq(c.cost_mana,3);assert(c.card_text.includes('Add 3 cards'))});
run('Midnight Lullaby CONDITION returns notes, then Draw before attack',()=>{let s=fresh();s.playerDeck=['S0-MAG-001'];s.playerHand=[];s.playerDiscard=['S0-ARC-026','S0-CLE-026'];const a={card_id:'S0-ARC-028',s0_discard_condition_picks:[{card_id:'S0-ARC-026',discard_index:0},{card_id:'S0-CLE-026',discard_index:1}]};q.consumeS0DiscardCondition(s,'PLAYER',q.card(a.card_id),a);eq(a.s0_condition_draw_count,1);eq(s.playerHand.length,1);eq(s.playerDiscard.length,0);eq(s.playerDeck.length,2)});
run('Blooming Harmony CONDITION returns two notes then draws 2',()=>{let s=fresh();s.playerDeck=['S0-MAG-001','S0-MAG-002'];s.playerHand=[];s.playerDiscard=['S0-CLE-026','S0-CLE-027'];const a={card_id:'S0-CLE-030',s0_discard_condition_picks:[{card_id:'S0-CLE-026',discard_index:0},{card_id:'S0-CLE-027',discard_index:1}]};q.consumeS0DiscardCondition(s,'PLAYER',q.card(a.card_id),a);eq(a.s0_condition_draw_count,2);eq(s.playerHand.length,2);eq(s.playerDiscard.length,0);eq(q.firstDrawCount(q.card(a.card_id)),0)});
run('Optional Soul Blast CENTER 2 options and SKIP preserves positions',()=>{let s=fresh();let a={card_id:'S0-ARC-016',source_side:'PLAYER',source_lane:'CENTER',target_side:'AI',target_lane:'CENTER',source_card_id:'S0-ARC-H002'};let options=q.soulBlastTargetSwapOptions(s,a);eq(options.length,2);let ids=Object.fromEntries(['LEFT','CENTER','RIGHT'].map(k=>[k,hp(s,'AI',k).card_id]));q.promptOptionalTargetSwap(s,a,null);eq(s.pending?.type,'optional_target_swap');eq(q.performOptionalTargetSwapDecision(null),true);for(let k of ['LEFT','CENTER','RIGHT'])eq(hp(s,'AI',k).card_id,ids[k])});
run('Optional Soul Blast LEFT 1 option still offers SKIP',()=>{let s=fresh();let a={card_id:'S0-ARC-016',source_side:'PLAYER',source_lane:'CENTER',target_side:'AI',target_lane:'LEFT',source_card_id:'S0-ARC-H002'};eq(q.soulBlastTargetSwapOptions(s,a).length,1);q.promptOptionalTargetSwap(s,a,null);eq(s.pending?.type,'optional_target_swap')});
run('Optional Soul Blast only adjacent, Freeze cancels illegal destination',()=>{let s=fresh();let a={card_id:'S0-ARC-016',source_side:'PLAYER',source_lane:'CENTER',target_side:'AI',target_lane:'CENTER'};hp(s,'AI','RIGHT').statuses=[{name:'Freeze',duration:1}];let opts=q.soulBlastTargetSwapOptions(s,a);eq(opts.length,1);eq(opts[0],'LEFT')});
run('Flash Slash left to right never allowed even if target RIGHT',()=>{let s=fresh();hp(s,'PLAYER','LEFT').card_id='S0-THF-H008';const a={card_id:'S0-THF-024',source_side:'PLAYER',source_lane:'LEFT',target_side:'AI',target_lane:'RIGHT'};eq(q.sourceSwapOptions(s,a).length,0)});
run('Flash Slash source LEFT to CENTER only when attacked CENTER',()=>{let s=fresh();hp(s,'PLAYER','LEFT').card_id='S0-THF-H008';const a={card_id:'S0-THF-024',source_side:'PLAYER',source_lane:'LEFT',target_side:'AI',target_lane:'CENTER'};assert(q.sourceSwapOptions(s,a).includes('CENTER'))});
run('Shadow Switch text and source excludes nonadjacent attacker-facing lane',()=>{let s=fresh();let d=hp(s,'PLAYER','LEFT');d.card_id='S0-THF-H008';const incoming={card_id:'S0-MAG-021',damage:40,damage_type:'Magical',attack_type:'Magical Attack',source_side:'AI',source_lane:'RIGHT',target_side:'PLAYER',target_lane:'LEFT',cannot_block:false,cannot_dodge:false,casting:false};s.playerHand=['S0-THF-023'];let opts=q.responseOptionsFor(s,'PLAYER',incoming);console.log('  shadow options',JSON.stringify(opts.map(x=>({id:x.card_id,side:x.source_lane}))), 'incoming',JSON.stringify(incoming),'cost', q.manaAvailableValueForCard(s,'PLAYER',q.card('S0-THF-023'))); assert(opts.some(x=>x.card_id==='S0-THF-023'),'no legal DODGE Response allowed for shadow switch')});
run('AI legal actions include newly-added Cards',()=>{let s=fresh('AI');s.aiHand=['S0-EVT-013','S0-ITM-021'];s.aiMana=25;let acts=q.getLegalActions('AI',s);console.log('  AI legal for new cards',acts.filter(x=>['S0-EVT-013','S0-ITM-021'].includes(x.card_id)).map(x=>x.card_id).slice(0,15)); console.log('  CHEERS diagnostics',JSON.stringify({tag:q.runtimeTagList(q.card('S0-EVT-013')),subtype:q.cardSubtype(q.card('S0-EVT-013')),response:q.isResponseOnly(q.card('S0-EVT-013')),needHero:q.requiresSourceHero(q.card('S0-EVT-013')),legal:q.legalPlayStateFor(s,'AI','S0-EVT-013'),src:q.legalSourceLanesFor(s,'AI','S0-EVT-013'),cost:q.manaAvailableValueForCard(s,'AI',q.card('S0-EVT-013')),timing:q.card('S0-EVT-013').timing})); assert(acts.some(x=>x.card_id==='S0-EVT-013'),'Cheers missing in AI legal actions');assert(acts.some(x=>x.card_id==='S0-ITM-021'),'Fire Flask missing in AI legal actions')});
run('Full commit: Fire Flask applies Burn for 2 turns to opposing Hero',()=>{
  let s=fresh();s.playerHand=['S0-ITM-021'];
  const target=hp(s,'AI','CENTER');target.statuses=[];target.hp=90;
  const ok=q.commitPlayedCard(s,{card_id:'S0-ITM-021',hand_index:0,source_side:'PLAYER',source_lane:'CENTER',target_side:'AI',target_lane:'CENTER'});
  assert(ok,'commitPlayedCard returned false');
  assert(!s.playerHand.includes('S0-ITM-021'));
  const status=(target.statuses||[]).find(x=>String(x.name||x.status||'').toLowerCase()==='burn');
  assert(status,'Burn status missing after full Item commit: '+JSON.stringify(target.statuses));
  eq(Number(status.duration||status.counters||0),2);
});
run('Full AI commit: Cheers Event exhausts user and draws opponent Hand size',()=>{
  let s=fresh('AI');s.phase='Deploy';
  s.aiHand=['S0-EVT-013','S0-MAG-001','S0-ARC-001'];s.playerHand=['S0-CLE-001','S0-MAG-001'];
  s.aiDeck=['S0-ARC-002','S0-ARC-003','S0-ARC-004'];
  let caster=hp(s,'AI','CENTER');caster.exhausted=false;
  const ok=q.commitPlayedCard(s,{card_id:'S0-EVT-013',hand_index:0,source_side:'AI',source_lane:'CENTER'});
  assert(ok,'commitPlayedCard returned false');assert(s.responseWindow?.kind==='incoming_card');assert(q.resolveResponseWindow(null),'No Response reactive window should resolve');console.log('  Cheers AI post',JSON.stringify({pending:s.pending,responseWindow:s.responseWindow,hand:s.aiHand,logs:s.log?.slice(0,9)}).slice(0,1600));eq(s.aiHand.length,2);
  assert(!s.aiHand.includes('S0-EVT-013'),'Cheers should leave Hand');
  assert(caster.exhausted,'Normal Event must Exhaust user');
});
console.log('\nRC42 GAMEPLAY QA',success,'/',cases,success===cases?'PASS':'FAIL');
if(success!==cases) process.exit(1);
