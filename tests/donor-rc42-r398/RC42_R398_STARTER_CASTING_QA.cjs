'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const root=path.resolve(__dirname,'../../public/battle');
const cx={console,URL,Date,Math,Array,JSON,Map,Set,Promise,Uint8Array,TextDecoder,TextEncoder,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},requestAnimationFrame:()=>0,cancelAnimationFrame(){},crypto:crypto.webcrypto};
cx.window=cx;cx.globalThis=cx;cx.location={href:'file:///index.html',origin:'file://'};cx.navigator={userAgent:'RC42 VM'};cx.document={readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null},querySelectorAll(){return []},createElement(){return {style:{},appendChild(){},setAttribute(){}}},documentElement:{classList:{toggle(){}}},body:{appendChild(){}}};
vm.createContext(cx);
const base=['engine/js/static-data.js','assets/review-db158/js/db166-view-model.js','engine/js/runtime-authority.js','engine/shared-app/active-starters.js','runtime/season0-generated/rc41-approved-print-overrides.js','runtime/season0-generated/rc42-main-deck-r398-overlay.js','engine/shared-app/app.bundle.js'];
for(const file of base){let src=fs.readFileSync(path.join(root,file),'utf8');if(file.endsWith('app.bundle.js'))src=src.replace(/\n\}\)\(\);\s*$/, '\nwindow.__RC42_TEST={initCards,card,heroState,buildInitialMatchState,commitPlayedCard,executeAIAction,getLegalActions,get state(){return appState},setState:s=>{appState=s;matchStarted=true;SUPPRESS_RENDER=true},sourceSwapOptions,soulBlastTargetSwapOptions,promptOptionalTargetSwap,performOptionalTargetSwapDecision,performOptionalSwapDecision,isMandatorySourceSwapCard,cardEffectSwapModel,responseOptionsFor,responseBlockAmount,lunMayBlockForHero,applySourcePostAttackEffects,applyNonAttackStatuses,consumeS0DiscardCondition,drawMany,gainMana,manaPoolCardsForSide,cardPlayCostForSource,firstDrawCount,heroClass,skillEffectSwapPairEligible,applyResolvedAttackDamage,resolveResponseWindow,addPrintedNamedCardFromDeck,applyImmediateEventItemEffects,applyAttackStatuses,adjacentLanes,positionLockedOneVsOne,recordAttackCardSwapResult,aiIntermediateDrawTwoPermitted,aiS4DrawAmount,aiAuraMainDeckDrawAmount,legalPlayStateFor,validateCardPreconditions,cardSubtype,runtimeTagList,isResponseOnly,requiresSourceHero,legalSourceLanesFor,manaAvailableValueForCard,responseDisplayItemsFor,responseKind,sourceCompatibleForResponse,validateAction,fullFor,thumbFor,previewManaRows,getCards:()=>CARD_BY_ID,legalTargetLanesFor,isCastingCard,resolvePendingCastingsFor,isLegacyModeHero,normalizeDeck,validateDeck,sourceCompatible,aiIntermediateCastingTargetAllowed,commitManaShardPaymentChoice};\n})();');vm.runInContext(src,cx,{filename:file,timeout:60000})}
const q=cx.__RC42_TEST;q.initCards();
let cases=0,success=0;
function run(title,fn){cases++;try{fn();console.log('PASS',title);success++;}catch(e){console.error('FAIL',title,e.stack||String(e));process.exitCode=1}}
function fresh(side='PLAYER'){let s=q.buildInitialMatchState();q.setState(s);s.preGame=null;s.turn=side;s.phase='Deploy';s.round=2;s.mana=30;s.aiMana=30;s.playerHand=[];s.aiHand=[];q.gainMana(s,'PLAYER',8);q.gainMana(s,'AI',8);return s}
function hand(s,side){return side==='AI'?s.aiHand:s.playerHand}
function hp(s,side,lane){return (side==='AI'?s.aiHeroes:s.playerHeroes)[lane]}
function eq(a,b,msg){assert.strictEqual(a,b,msg)}

const zRoot=path.join(root,'engine/starter_deck_examples/official_exports');
const officialNames=['1_Blue_Red_Deck.json','2_Yellow_Blue_Deck.json','3_Red_White_Deck.json','4_Green_Yellow_Deck.json','5_White_Green_Deck.json'];
const ids=['s0_starter_01_blue_red','s0_starter_02_yellow_blue','s0_starter_03_red_white','s0_starter_04_green_yellow','s0_starter_05_white_green'];
const comps=['main_deck','legacy_deck_package_slots','default_formation'];
function cmp(a,b,msg){ assert.deepStrictEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),msg); }
const meta=cx.GL_ACTIVE_STARTER_SET_META;
run('Active Starter set has five approved decks',()=>{eq(meta.active_starter_count,5);cmp(meta.ids,ids);eq(Object.keys(cx.GL_ACTIVE_STARTER_DECKS).length,5)});
for(let i=0;i<5;i++){
 const id=ids[i], src=JSON.parse(fs.readFileSync(path.join(zRoot,officialNames[i]))),active=cx.GL_ACTIVE_STARTER_DECKS[id];
 const saved=JSON.parse(fs.readFileSync(path.join(root,'engine/starter_deck_examples',path.basename(active.file))));
 run('Starter '+(i+1)+' raw source checksum and runtime matches byte-identical authority',()=>{
   const raw=fs.readFileSync(path.join(zRoot,officialNames[i]));
   eq(crypto.createHash('sha256').update(raw).digest('hex'),active.deck.source_export_sha256);
   eq(active.deck.deck_name,src.deck_name);
   cmp(active.deck.main_deck,src.main_deck);
   cmp(active.deck.mana_deck,src.shard_deck);
   cmp(active.deck.legacy_deck_package_slots,src.legacy_deck_package_slots);
   cmp(active.deck.default_formation,src.default_formation);
   cmp(saved.main_deck,src.main_deck);cmp(saved.mana_deck,src.shard_deck);
   cmp(saved.legacy_deck_package_slots,src.legacy_deck_package_slots);
   cmp(saved.default_formation,src.default_formation);
   eq(active.deck.main_deck.reduce((a,x)=>a+x.quantity,0),50);
   eq(active.deck.mana_deck.reduce((a,x)=>a+x.quantity,0),12);
   eq(active.deck.legacy_deck_expanded.length,12);
   eq(q.validateDeck(saved,'PLAYER').ok,true);
 });
}
run('Rulebook v3.5 SHA-256 matches the independently verified authoritative PDF',()=>{
 const a=fs.readFileSync(path.resolve(__dirname,'../../docs/reference/Grandis_Legacy_Player_Rulebook_v3.5_EN_2026-11-20.pdf'));
 eq(crypto.createHash('sha256').update(a).digest('hex'),'e68d9153b0c77a3ff515aa093a7319e971c07d85224b38b5879a426c96071da0');
 const external=process.env.GL_RULEBOOK_SOURCE_PDF;
 if(external){const b=fs.readFileSync(external);eq(a.equals(b),true);}
});
function legacyAt(s,side,lane){
 const h=hp(s,side,lane);
 h.legacy_mode=true;h.active_legacy_card_id='S0-CLE-L001';h.hp=0;
 return h;
}
function makeCaster(side){
 const s=fresh(side);
 s.phase='Battle';s.turn=side;
 const own=hp(s,side,'CENTER');own.card_id='S0-MAG-H001';own.hp=100;own.maxHp=100;own.exhausted=false;own.attachments=[null,null];own.statuses=[];
 if(side==='PLAYER'){s.playerHand=['S0-MAG-020'];s.mana=30;}else{s.aiHand=['S0-MAG-020'];s.aiMana=30;}
 const enemy=side==='PLAYER'?'AI':'PLAYER';legacyAt(s,enemy,'LEFT');
 return s;
}
run('Casting card recognizes locked position',()=>assert(q.isCastingCard(q.card('S0-MAG-020'))));
run('Casting allows Legacy target from Player and AI, normal attacks still reject',()=>{
 for(const side of ['PLAYER','AI']){
   let s=makeCaster(side), enemy=side==='PLAYER'?'AI':'PLAYER';
   const casting=q.legalTargetLanesFor(s,side,'S0-MAG-020','CENTER');
   assert(casting.includes('LEFT'),side+' casting cannot lock Legacy at LEFT: '+JSON.stringify(casting));
   const norm=q.legalTargetLanesFor(s,side,'S0-MAG-005','CENTER');
   assert(!norm.includes('LEFT'),side+' normal attack wrongly targeting Legacy');
   const action={type:'PLAY_CARD',card_id:'S0-MAG-020',source_side:side,source_lane:'CENTER',target_side:enemy,target_lane:'LEFT'};
   const check=q.validateAction(s,side,action);
   assert(check.ok,side+' target Legacy validation failed: '+JSON.stringify(check));
 }
});
run('Casting respects source AoA for position-lock, including Legacy slots',()=>{
 let s=makeCaster('PLAYER');s.playerHeroes.CENTER.card_id='S0-MAG-H001';
 for(const lane of ['LEFT','CENTER','RIGHT']){
   const my=hp(s,'PLAYER',lane);my.card_id='S0-MAG-H001';my.hp=100;
   const targets=q.legalTargetLanesFor(s,'PLAYER','S0-MAG-020',lane);
   if(lane==='LEFT')assert(!targets.includes('RIGHT'));
   if(lane==='RIGHT')assert(!targets.includes('LEFT'));
 }
});
run('Casting declared on a Legacy slot releases with 0 damage if still Legacy',()=>{
 const s=makeCaster('PLAYER');q.setState(s);
 const ok=q.commitPlayedCard(s,{card_id:'S0-MAG-020',hand_index:0,source_side:'PLAYER',source_lane:'CENTER',target_side:'AI',target_lane:'LEFT'});
 assert(ok,'Casting declaration failed'); if(s.pending?.type==='mana_shard_payment_choice')assert(q.commitManaShardPaymentChoice(),'Player failed to confirm Mana cost');
 assert(s.pendingCastings?.length>0,'No pending casting after declaration');
 const pc=s.pendingCastings[0];eq(pc.locked_target_lane||pc.target_lane,'LEFT');
 pc.counters=pc.required_counters||1;
 q.resolvePendingCastingsFor(s,'PLAYER');
 eq(s.pendingCastings.length,0);
 assert(!s.responseWindow,'Legacy must not open a defense response');
 assert(s.log.some(line=>line.includes('Casting Attack resolves without dealing HP damage')),'Missing no-target resolution log');
});
run('Casting declared on Legacy slot hits the active Hero occupying slot at release',()=>{
 const s=makeCaster('AI');q.setState(s);
 const declared=q.commitPlayedCard(s,{card_id:'S0-MAG-020',hand_index:0,source_side:'AI',source_lane:'CENTER',target_side:'PLAYER',target_lane:'LEFT'});
 assert(declared,'Casting declaration failed for AI');assert(s.pendingCastings?.length>0,'AI casting was not queued');
 const left=s.playerHeroes.LEFT,right=s.playerHeroes.RIGHT;assert(q.isLegacyModeHero(left));
 s.playerHeroes.LEFT=right;s.playerHeroes.RIGHT=left;
 const pc=s.pendingCastings[0];pc.counters=pc.required_counters||1;
 q.resolvePendingCastingsFor(s,'AI');
 eq(s.pendingCastings.length,0);
 assert(s.responseWindow,'Casting release must open Response on a newly moved Hero');
 eq(s.responseWindow.target_lane,'LEFT');
});
run('AI legal action generator includes Casting targeting Legacy slot',()=>{
 const s=makeCaster('AI');q.setState(s);
 const opts=q.getLegalActions('AI',s).filter(a=>a.card_id==='S0-MAG-020'&&a.target_lane==='LEFT');
 assert(opts.length>0,'AI must have the same legal Casting position choice as Player');
});
console.log('STARTER + CASTING QA',success+'/'+cases,success===cases?'PASS':'FAIL');if(success!==cases)process.exitCode=1;
