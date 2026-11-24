import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
const BUILD='gl-s0-pvp-rc42-r398-r40-20261124-b';
const PORT=21200+Math.floor(Math.random()*800);
const proc=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,HOST:'127.0.0.1',PORT:String(PORT),IDLE_SWEEP_MS:'900'},stdio:['ignore','pipe','pipe']});
let log='';proc.stdout.on('data',b=>log+=b.toString());proc.stderr.on('data',b=>log+=b.toString());
const wait=async fn=>{for(let i=0;i<130;i++){if(fn())return;await delay(70)}throw Error('Timed out: '+log.slice(-700))};
function watch(ws){
 const messages=[];ws.addEventListener('message',e=>{try{messages.push(JSON.parse(String(e.data)))}catch{}});
 async function until(fn,deadline=7000){
  for(let i=0;i<deadline/30;i++){const found=messages.find(fn);if(found)return found;await delay(30)}
  throw Error('Waited for packet; recent: '+JSON.stringify(messages.slice(-4)).slice(0,850));
 }
 return{ws,messages,until,send(type,params={}){ws.send(JSON.stringify({type,clientBuildId:BUILD,...params}))}};
}
try{
 await wait(()=>log.includes('Listening'));
 async function join(client){const ws=new WebSocket(`ws://127.0.0.1:${PORT}/ws?`+new URLSearchParams({client,name:client,role:'player',buildId:BUILD}));
   const ch=watch(ws);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
   await ch.until(m=>m.type==='snapshot'&&m.local?.role==='player');return ch;}
 const a=await join('RC42-Test-P1'),b=await join('RC42-Test-P2');
 try{
  assert.equal((await a.until(m=>m.type==='snapshot')).local.seat,1);
  assert.equal((await b.until(m=>m.type==='snapshot')).local.seat,2);
  const keys=['s0_starter_01_blue_red','s0_starter_02_yellow_blue'];
  a.send('set-deck',{deckKey:keys[0]});b.send('set-deck',{deckKey:keys[1]});
  await a.until(m=>m.type==='snapshot'&&m.local?.deckKey===keys[0]);
  await b.until(m=>m.type==='snapshot'&&m.local?.deckKey===keys[1]);
  a.send('ready',{ready:true});b.send('ready',{ready:true});
  await a.until(m=>m.type==='snapshot'&&m.players?.length===2&&m.players.every(x=>x.ready));
  a.send('start-match');
  await a.until(m=>m.type==='snapshot'&&m.match.status==='coin-flip');
  await b.until(m=>m.type==='snapshot'&&m.match.status==='coin-flip');
  b.send('choose-coin-flip',{choice:'HEADS'});
  const r=await a.until(m=>m.type==='snapshot'&&m.match.status==='coin-result');
  const win=Number(r.match.winnerSeat),winner=win===1?a:b;
  winner.send('choose-turn-order',{order:'FIRST'});
  await a.until(m=>m.type==='snapshot'&&m.match.turnOrder==='FIRST');
  a.send('coin-presented');b.send('coin-presented');
  const started1=await a.until(m=>m.type==='snapshot'&&m.match.status==='started');
  const started2=await b.until(m=>m.type==='snapshot'&&m.match.status==='started');
  assert.equal(started1.match.revision,started2.match.revision);
  assert.ok(started1.match.board?.appState&&started2.match.board?.appState);
  assert.equal(started1.local.seat,1);assert.equal(started2.local.seat,2);
  // Cross-seat unauthorized intent with a stale revision is rejected by server.
  const actor=win===1?a:b;
  actor.send('runtime-intent',{clientActionId:'rc42.two-seat.stale',baseRevision:-7,intent:'advancePhase',args:[]});
  const bad=await actor.until(m=>m.type==='intent-result'&&m.clientActionId==='rc42.two-seat.stale');
  assert.equal(bad.ok,false);assert.equal(bad.code,'STALE_REVISION');
  // Surrender is an intentional irreversible action; both seats get the same result.
  actor.send('surrender-match',{clientActionId:'rc42.two-seat.surrender',baseRevision:started1.match.revision});
  const done=await actor.until(m=>m.type==='intent-result'&&m.clientActionId==='rc42.two-seat.surrender');
  assert.equal(done.ok,true);
  assert.equal(done.snapshot?.match?.status,'finished');
  const other=actor===a?b:a;
  await other.until(m=>m.type==='snapshot'&&m.match.status==='finished');
  console.log('PASS RC42 two humans: ready, server coin, turn order, opening, masked snapshots, stale-revision rejection, match finish');
 }finally{a.ws.close();b.ws.close()}
}finally{proc.kill('SIGTERM')}
