import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const hostSrc=readFileSync(join(root,'public/pvp/pvp-host.js'),'utf8');
const serverSrc=readFileSync(join(root,'server.js'),'utf8');
const buildId=/const BUILD_ID='([^']+)'/.exec(serverSrc)?.[1];
assert.ok(buildId);
assert.match(hostSrc,/payloadKey:importDeckSignature\(raw\)/);
assert.match(hostSrc,/importDeckSignature\(got\)!==job\.payloadKey/);
const extract=name=>{
  const start=hostSrc.indexOf(`function ${name}(`);
  assert.ok(start>=0,'Missing '+name);
  const end=hostSrc.indexOf('\n}',start);
  assert.ok(end>=0,'Missing closing brace '+name);
  return hostSrc.slice(start,end+2);
};
const sb={state:{customDeck:null,customDeckName:'',deckKey:'',formation:null},pendingDeckImport:null,
  saved:new Map(),status:[],clearTimeout(){},clone(v){return JSON.parse(JSON.stringify(v))},
  persist(k,v){sb.saved.set(k,v)},reportDeckImportStatus(k,m){sb.status.push([k,m])}};
vm.createContext(sb);
vm.runInContext(extract('importDeckSignature')+'\n'+extract('confirmImportedDeckFromSnapshot'),sb);
const exportsDir=join(root,'public/battle/engine/starter_deck_examples/official_exports');
const raw1=JSON.parse(readFileSync(join(exportsDir,'1_Blue_Red_Deck.json'),'utf8'));
const raw2=JSON.parse(readFileSync(join(exportsDir,'2_Yellow_Blue_Deck.json'),'utf8'));
assert.ok(raw1.deck&&raw1.default_formation,'Official export must use nested Deck Builder schema');
assert.ok(raw2.deck&&raw2.default_formation);
const port=21000+Math.floor(Math.random()*5000);
const child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',d=>logs+=d.toString());child.stderr.on('data',d=>logs+=d.toString());
function packet(ws,pred,timeout=7000){return new Promise((resolve,reject)=>{
  const t=setTimeout(()=>{ws.removeEventListener('message',fn);reject(Error('Socket timeout: '+logs.slice(-1600)))},timeout);
  function fn(ev){let m;try{m=JSON.parse(String(ev.data))}catch{return}if(pred(m)){clearTimeout(t);ws.removeEventListener('message',fn);resolve(m)}}
  ws.addEventListener('message',fn);
})}
function setJob(raw, name){sb.pendingDeckImport={payloadKey:sb.importDeckSignature(raw),name,formation:raw.default_formation,timer:null};sb.state.customDeck=null;sb.status.length=0;sb.saved.clear()}
async function accept(ws,raw,name){
  const p=packet(ws,m=>m.type==='snapshot'&&m.local?.deckName===name);
  ws.send(JSON.stringify({type:'set-deck',clientBuildId:buildId,customDeck:raw,deckName:name,formation:raw.default_formation}));
  return await p;
}
try {
  for(let n=0;n<100&&(!logs.includes('Listening'));n++)await delay(70);
  assert.match(logs,/Listening/,'Backend must start: '+logs);
  const health=await(await fetch(`http://127.0.0.1:${port}/health`)).json();
  assert.equal(health.buildId,buildId);
  const ws=new WebSocket(`ws://127.0.0.1:${port}/ws?`+new URLSearchParams({client:'hf1-import-test',name:'PVP-HF1-TEST',role:'player',buildId}));
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
  try{
    const snap1=await accept(ws,raw1,'Import A');
    assert.notEqual(JSON.stringify(raw1),JSON.stringify(snap1.local.customDeck),'Server must normalize original export (old byte-equality condition was broken)');
    assert.equal(sb.importDeckSignature(raw1),sb.importDeckSignature(snap1.local.customDeck),'Requested and canonical deck semantics must match');
    setJob(raw1,'Import A');
    sb.confirmImportedDeckFromSnapshot(snap1);
    assert.equal(sb.pendingDeckImport,null,'Authoritative import must finish');
    assert.equal(sb.status.at(-1)?.[0],'success','A valid import must show success');
    assert.equal(sb.state.customDeckName,'Import A');
    assert.ok(sb.saved.has('custom'));
    console.log('PASS: Real WS normalized import A -> exact semantic confirmation and local persistence');

    setJob(raw2,'Import B');
    sb.confirmImportedDeckFromSnapshot(snap1);
    assert.ok(sb.pendingDeckImport,'Unrelated old snapshot may NOT confirm new import');
    assert.equal(sb.status.length,0);
    console.log('PASS: stale previous import snapshot is not accepted');

    const snap2=await accept(ws,raw2,'Import B');
    sb.confirmImportedDeckFromSnapshot({...snap2,local:{...snap2.local,formation:{...snap2.local.formation,LEFT:'INVALID'}}});
    assert.ok(sb.pendingDeckImport,'Wrong formation may NOT confirm import');
    sb.confirmImportedDeckFromSnapshot(snap2);
    assert.equal(sb.pendingDeckImport,null);
    assert.equal(sb.status.at(-1)?.[0],'success');
    console.log('PASS: Real WS normalized import B -> confirmation; tampered formation rejected');
    // All five official current Deck Builder exports must survive the same
    // end-to-end path. The previous check only covered server acceptance,
    // not the front-end's ability to recognize that accepted snapshot.
    for(let i=3;i<=5;i++){
      const names={3:'3_Red_White_Deck.json',4:'4_Green_Yellow_Deck.json',5:'5_White_Green_Deck.json'};
      const raw=JSON.parse(readFileSync(join(exportsDir,names[i]),'utf8'));
      const name='Import '+i;
      const snap=await accept(ws,raw,name);
      setJob(raw,name);
      sb.confirmImportedDeckFromSnapshot(snap);
      assert.equal(sb.pendingDeckImport,null,'Official Deck '+i+' must confirm');
      assert.equal(sb.status.at(-1)?.[0],'success','Official Deck '+i+' must display success');
      assert.equal(sb.state.customDeckName,name);
    }
    console.log('PASS: All five official Deck Builder 1.68 exports get server confirmation');
  }finally{ws.close()}
}finally{child.kill('SIGTERM')}
