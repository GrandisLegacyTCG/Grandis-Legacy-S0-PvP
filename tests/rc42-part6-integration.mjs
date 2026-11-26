import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {Season0HeadlessAuthority} from '../server/headless-rc32.mjs';
import {season0StarterCatalog} from '../server/s0-pregame-catalog.mjs';
import {viewerSafeBoard,assertViewerSafeBoard} from '../server/viewer-safe.mjs';

const root=process.cwd(), battle=join(root,'public/battle');
const buildId='gl-s0-pvp-rc44-r40-r40-20261127';
const starter=Object.keys(season0StarterCatalog);
assert.equal(starter.length,5);
for(const key of starter){
  const deck=season0StarterCatalog[key].deck;
  assert.equal(deck.main_deck.reduce((a,c)=>a+Number(c.quantity),0),50,key);
  assert.equal(deck.legacy_deck_expanded.length,12,key);
  for(const id of new Set([...deck.main_deck.map(x=>x.card_id),...deck.legacy_deck_expanded.map(x=>x.card_id)]))
    assert.ok(existsSync(join(battle,'card-art',id+'.webp')),'Missing '+id);
}
const context={};context.window=context;
for (const f of ['engine/js/static-data.js','runtime/season0-generated/rc41-approved-print-overrides.js','runtime/season0-generated/rc42-main-deck-r398-overlay.js'])
  vm.runInNewContext(readFileSync(join(battle,f),'utf8'),context,{filename:f});
assert.equal(context.GRANDIS_LEGACY_CARD_PREVIEW.active_main_deck,'R3.98');
assert.equal(context.GRANDIS_LEGACY_CARD_PREVIEW.active_legacy_deck,'R4.0');
for(const id of ['S0-EVT-013','S0-ITM-021'])
  assert.ok(context.GRANDIS_LEGACY_CARD_PREVIEW.cards.find(x=>x.card_id===id),'RC42 missing '+id);
for(const first of [1,2]){
  const a=new Season0HeadlessAuthority(battle);
  a.start({player1Deck:season0StarterCatalog[starter[0]].deck,
           player2Deck:season0StarterCatalog[starter[1]].deck});
  a.completeOpening(first,'HEADS');
  for(const seat of [1,2]){
    const safe=viewerSafeBoard(a._viewForMaskingOnly(seat),{seat,revision:a.revision,secret:Buffer.alloc(32)});
    assertViewerSafeBoard(safe);
  }
}
console.log('PASS RC42 content/starter card art/2-seat headless privacy');

const port=19200+Math.floor(Math.random()*1500),base='http://127.0.0.1:'+port;
const child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',IDLE_SWEEP_MS:'1000'},stdio:['ignore','pipe','pipe']});
let serverLog='';child.stdout.on('data',d=>serverLog+=d.toString());child.stderr.on('data',d=>serverLog+=d.toString());
const waitFor=async pred=>{for(let j=0;j<75;j++){if(pred())return;await delay(85)}throw Error('Timeout: '+serverLog.slice(-1600));};
const onMessage=(ws,pred,timeout=4500)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{ws.removeEventListener('message',listener);reject(Error('WebSocket timeout waiting for message'))},timeout);
  function listener(e){let data;try{data=JSON.parse(String(e.data))}catch{return}if(pred(data)){clearTimeout(timer);ws.removeEventListener('message',listener);resolve(data)}}
  ws.addEventListener('message',listener);
});
try{
  await waitFor(()=>serverLog.includes('Listening'));
  const meta=await(await fetch(base+'/health')).json();
  assert.equal(meta.buildId,buildId);
  assert.equal((await fetch(base+'/pvp/')).status,200);
  assert.equal((await fetch(base+'/pvp/battle/')).status,200);
  const url='ws://127.0.0.1:'+port+'/ws?'+new URLSearchParams({client:'rc42-integration-test',name:'Test Runner',role:'player',buildId});
  const ws=new WebSocket(url);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
  try{
    let packet=onMessage(ws,m=>m.type==='snapshot');ws.send(JSON.stringify({type:'resync',clientBuildId:buildId}));let initial=await packet;
    assert.equal(initial.local.role,'player');
    const flat=season0StarterCatalog[starter[0]].deck;
    const groups=new Map();
    for(const row of flat.legacy_deck_expanded){const k=row.package_id;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row)}
    const legacy_packages=[...groups.values()].map(rows=>({hero_rank_ids:rows.filter(x=>x.card_type==='Hero').map(x=>x.card_id),legacy_card_id:rows.find(x=>x.card_type==='Legacy')?.card_id}));
    assert.equal(legacy_packages.length,3);
    const nested={schema_version:'GL-DECK-1.0',season:'S0',deck_name:'Part 6 Import',default_formation:flat.default_formation,
      deck:{main_deck:flat.main_deck,shard_deck:flat.mana_deck,legacy_packages}};
    packet=onMessage(ws,m=>m.type==='snapshot'&&m.local?.deckName==='Part 6 Import');
    ws.send(JSON.stringify({type:'set-deck',clientBuildId:buildId,customDeck:nested,deckName:'Part 6 Import',formation:flat.default_formation}));
    const imported=await packet;
    assert.equal(imported.local.customDeck.main_deck_count,50);
    assert.equal(imported.local.customDeck.legacy_deck_expanded.length,12);
    assert.equal(imported.local.customDeck.deck,undefined,'Server retains normalized flat deck, never nested envelope');
    // Invalid formation must not erase the accepted deck and must not alter the room.
    packet=onMessage(ws,m=>m.type==='error');
    ws.send(JSON.stringify({type:'set-deck',clientBuildId:buildId,customDeck:nested,deckName:'Bad formation',
       formation:{LEFT:flat.default_formation.CENTER,CENTER:flat.default_formation.CENTER,RIGHT:flat.default_formation.RIGHT}}));
    const rejected=await packet;
    assert.match(rejected.message,/Formation/);
    assert.equal(rejected.snapshot.local.deckName,'Part 6 Import');
    assert.equal(rejected.snapshot.local.customDeck.main_deck_count,50);
    packet=onMessage(ws,m=>m.type==='snapshot'&&m.local?.deckKey===starter[1]);
    ws.send(JSON.stringify({type:'set-deck',clientBuildId:buildId,deckKey:starter[1]}));
    const selected=await packet;
    assert.equal(selected.local.customDeck,null);
    assert.equal(selected.local.deckKey,starter[1]);
    console.log('PASS RC42 live HTTP /pvp routes, WS normalized Deck Builder import, atomic rejection, starter switching');
  }finally{ws.close()}
}finally{child.kill('SIGTERM')}
