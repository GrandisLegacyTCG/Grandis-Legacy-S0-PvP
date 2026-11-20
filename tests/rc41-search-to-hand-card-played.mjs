import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {viewerSafeBoard,assertViewerSafeBoard} from '../server/viewer-safe.mjs';
const root=join(process.cwd(),'public/battle');
const src=readFileSync(resolve('server/headless-rc32.mjs'),'utf8');
const anchor='  /** A verified seat may concede without turn/response ownership. */';
assert(src.includes(anchor));
const source=src
 .replace("import {PvpCombatPresentationLedger} from './combat-presentation.mjs';",`import {PvpCombatPresentationLedger} from '${pathToFileURL(resolve('server/combat-presentation.mjs')).href}';`)
 .replace("import {PvpDiscardPresentationLedger} from './discard-presentation.mjs';",`import {PvpDiscardPresentationLedger} from '${pathToFileURL(resolve('server/discard-presentation.mjs')).href}';`)
 .replace(anchor,`  injectFixtureForChoiceQA(snapshot){this.#canonical=structuredClone(snapshot);this.#bridgeSeat=null;this.#bridgeRevision=-1;}\n${anchor}`);
const {Season0HeadlessAuthority:Authority}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source));
const hide='__HIDDEN_CARD_BACK__';
for(const seat of [1,2]){
 const a=new Authority(root);
 a.start({player1DeckKey:'s0_starter_03_red_white',player2DeckKey:'s0_starter_01_blue_red'});
 a.completeOpening(1,'HEADS');
 const raw=a._canonicalForServerOnly(),s=raw.appState;
 const actorSide=seat===1?'PLAYER':'AI',pfx=seat===1?'player':'ai',token='qa-committed-choice-'+seat;
 const physical=s[pfx+'Deck'].slice();
 assert(physical.length>4);const selectedIds=[physical[0],physical[2]];
 const action={id:'pvp_'+actorSide+'_search_qa_'+seat,label:'ITEM',card_id:'S0-ITM-018',title:'Magic Compass',
   source_side:actorSide,source_lane:'CENTER',target_side:actorSide,target_lane:'CENTER',round:3,phase:'Deploy',turn:actorSide,
   played_event_order:30,commit_token:token,card_movements:[],timestamp:Date.now()};
 const olderAction={...action,id:'pvp_'+actorSide+'_older_'+seat,played_event_order:29,commit_token:'unrelated-commit'};
 const ordinaryDraw={...action,id:'pvp_'+actorSide+'_draw_'+seat,played_event_order:28,commit_token:'unrelated-draw',
   card_movements:[{from:'Main Deck',to:'Hand',count:1,known:true,card_ids:[physical[0]]}]};
 s.pvpActionEventsBySide={PLAYER:[],AI:[]};s.pvpActionEventsBySide[actorSide]=[action,olderAction,ordinaryDraw];
 s.presentationEvents=[];s.presentationEventSequence=0;
 s.turn=actorSide;s.phase='Deploy';s.responseWindow=null;s.gameOver=false;
 s.pending={type:'card_search_choice',side:actorSide,decision_side:actorSide,zone:'deck',source_card_id:'S0-ITM-018',
   resolve_to:'',commit_token:token,multi_select:true,max_count:2,required_count:2,selected_indices:[],selected_index:null,
   candidates:[0,1,2].map(i=>({card_id:physical[i],deck_index:i}))};
 a.injectFixtureForChoiceQA(raw);
 const ownView=viewerSafeBoard(a._viewForMaskingOnly(seat),{seat,revision:a.revision,secret:Buffer.alloc(32)});
 assertViewerSafeBoard(ownView);
 assert(ownView.appState.playerDeck.every(id=>id===hide));
 assert.equal(ownView.appState.pending.candidates[0].card_id,physical[0]);
 const beforeRev=a.revision;
 assert.throws(()=>a.applyIntent(seat,'commitExactCardSearchChoice',[{indices:[0,0],token,zone:'deck',source:'S0-ITM-018',resolveTo:''}]));
 assert.equal(a.revision,beforeRev);
 const result=a.applyIntent(seat,'commitExactCardSearchChoice',[{indices:[0,2],token,zone:'deck',source:'S0-ITM-018',resolveTo:''}]);
 assert.equal(result.ok,true);
 const committed=a._canonicalForServerOnly().appState;
 assert.equal(committed.pending,null,'Search must always exit selected-card pending');
 assert(selectedIds.every(id=>committed[pfx+'Hand'].includes(id)));
 const liveAction=committed.pvpActionEventsBySide[actorSide].find(x=>x.id===action.id);
 assert.equal(liveAction.card_movements.length,2,'exactly two physical card pickup rows');
 assert(liveAction.card_movements.every(x=>x.known&&x.to==='Hand'));
 const notes=committed.presentationEvents.filter(e=>e.type==='CARD_PUBLIC_PICKUP');
 assert.equal(notes.length,2);assert(notes.every(e=>e.source_action_id===action.id));
 for(const viewerSeat of [1,2]){
  const view=viewerSafeBoard(a._viewForMaskingOnly(viewerSeat),{seat:viewerSeat,revision:a.revision,secret:Buffer.alloc(32)});
  assertViewerSafeBoard(view);
  const st=view.appState,shownSide=viewerSeat===seat?'PLAYER':'AI';
  const publicAction=st.pvpActionEventsBySide[shownSide].find(e=>e.id===action.id);
  assert(publicAction,'Card Played must include source action on both seats');
  assert.deepEqual(publicAction.card_movements.flatMap(m=>m.card_ids).sort(),selectedIds.slice().sort());
  assert(st.presentationEvents.filter(e=>e.type==='CARD_PUBLIC_PICKUP').every(e=>e.side===shownSide));
  assert(st.playerDeck.every(id=>id===hide)&&st.aiDeck.every(id=>id===hide),'entire Main Deck remains hidden');
  assert(st.aiHand.every(id=>id===hide),'opponent Hand remains hidden');
  for(const id of [olderAction.id,ordinaryDraw.id]){
   const old=st.pvpActionEventsBySide[shownSide].find(e=>e.id===id);
   assert(!old.card_movements?.some(m=>m.card_ids.includes(physical[0])),'must not copy Search result onto other actions or a Draw');
  }
 }
 console.log('PASS Search-to-Hand + notification + exact Card Played results, both views, seat',seat);
}
console.log('PASS committed Search/Return source-action privacy and authority');
