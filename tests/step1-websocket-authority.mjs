import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
const BUILD = 'gl-s0-pvp-rc42-r398-r40-20261124-s3';
const port = 25100 + Math.floor(Math.random()*2200);
const processHandle=spawn(process.execPath,['server.js'],{
 cwd:process.cwd(),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),IDLE_SWEEP_MS:'5000'},stdio:['ignore','pipe','pipe']
});
let logs='';processHandle.stdout.on('data',d=>logs+=d);processHandle.stderr.on('data',d=>logs+=d);
async function wait(check,ms=9000){const deadline=Date.now()+ms;while(Date.now()<deadline){const v=check();if(v)return v;await sleep(20);}throw Error('WS timeout '+logs.slice(-300));}
async function connect(id,role='player',seatToken=''){
 const params=new URLSearchParams({client:id,name:id,role,buildId:BUILD});if(seatToken)params.set('seatToken',seatToken);
 const ws=new WebSocket('ws://127.0.0.1:'+port+'/ws?'+params.toString());const msgs=[];
 ws.addEventListener('message',event=>{try{msgs.push(JSON.parse(String(event.data)))}catch{}});
 await new Promise((yes,no)=>{ws.addEventListener('open',yes,{once:true});ws.addEventListener('error',no,{once:true})});
 const ch={ws,id,msgs,send(type,content={}){ws.send(JSON.stringify({type,clientBuildId:BUILD,...content}));},
  until:(f,ms)=>wait(()=>msgs.find(f),ms),last:()=>msgs.at(-1)};
 await ch.until(m=>m.type==='snapshot');return ch;
}
try{
 await wait(()=>logs.includes('Listening'),25000);
 const a=await connect('step1-seat-1'),b=await connect('step1-seat-2'),spec=await connect('step1-spectator','spectator');
 try {
  assert.equal(a.msgs[0].local.seat,1);assert.equal(b.msgs[0].local.seat,2);
  a.send('set-deck',{deckKey:'s0_starter_01_blue_red'});b.send('set-deck',{deckKey:'s0_starter_02_yellow_blue'});
  await a.until(m=>m.local?.deckKey==='s0_starter_01_blue_red');
  await b.until(m=>m.local?.deckKey==='s0_starter_02_yellow_blue');
  a.send('ready',{ready:true});b.send('ready',{ready:true});await a.until(m=>m.players?.every(x=>x.ready));
  a.send('start-match');await a.until(m=>m.match?.status==='coin-flip');
  b.send('choose-coin-flip',{choice:'HEADS'});
  const flip=await a.until(m=>m.match?.status==='coin-result');
  const winner=flip.match.winnerSeat===1?a:b;
  winner.send('choose-turn-order',{order:'FIRST'});
  await a.until(m=>m.match?.turnOrder==='FIRST');
  a.send('coin-presented');b.send('coin-presented');
  const open=await a.until(m=>m.match?.status==='started');
  await b.until(m=>m.match?.status==='started');
  const initialRevision=open.match.revision,actor=open.match.firstSeat===1?a:b,other=actor===a?b:a;
  // Refuse an unsigned mutating action without touching the game state.
  actor.send('runtime-intent',{baseRevision:initialRevision,intent:'advancePhase',args:[]});
  const noId=await actor.until(m=>m.type==='error'&&m.code==='MISSING_ACTION_ID');
  assert.equal(noId.snapshot.match.revision,initialRevision,'No-ID action must not commit');
  assert.equal(noId.snapshot.match.board.appState.pending,open.match.board.appState.pending);
  actor.send('resync'); const stable=await actor.until(m=>m.type==='snapshot'&&m.forceImport&&m.match.status==='started');
  assert.equal(stable.match.revision,initialRevision);
  console.log('PASS missing action ID never mutates the authoritative state');
  const id='step1.valid.advance.0001';
  const req={clientActionId:id,baseRevision:initialRevision,intent:'advancePhase',args:[]};
  actor.send('runtime-intent',req);
  const ack=await actor.until(m=>m.type==='intent-result'&&m.clientActionId===id);
  assert.equal(ack.ok,true);assert.equal(ack.appliedRevision,initialRevision+1);
  assert.equal(ack.snapshot.match.revision,initialRevision+1);
  const mirror=await other.until(m=>m.type==='snapshot'&&m.match?.revision===initialRevision+1);
  assert.equal(mirror.match.revision,ack.snapshot.match.revision);
  assert.equal(mirror.match.board.appState.aiHand.every(x=>x==='__HIDDEN_CARD_BACK__'),true,'Opponent private Hand stays private');
  const spectatorView=await spec.until(m=>m.match?.revision===initialRevision+1);
  assert.equal(spectatorView.match.board.appState.aiHand.every(x=>x==='__HIDDEN_CARD_BACK__'),true);
  assert.equal(spectatorView.match.board.appState.pvpLocalLegalLegacyAbilities,undefined,'Spectators must not receive private Legacy legality');
  for(const v of [ack.snapshot,mirror])assert.deepEqual(Object.keys(v.match.board.appState.pvpLocalLegalLegacyAbilities).sort(),['CENTER','LEFT','RIGHT']);
  console.log('PASS actor ACK + viewer-safe opponent/spectator snapshots share the committed revision');
  actor.send('runtime-intent',req);
  const acks=actor.msgs.filter(m=>m.type==='intent-result'&&m.clientActionId===id);
  const replay=await wait(()=>actor.msgs.filter(m=>m.type==='intent-result'&&m.clientActionId===id).length>acks.length?
    actor.msgs.filter(m=>m.type==='intent-result'&&m.clientActionId===id).at(-1):null);
  assert.equal(replay.ok,true);assert.equal(replay.appliedRevision,initialRevision+1);
  assert.equal(replay.snapshot.match.revision,initialRevision+1);
  actor.send('runtime-intent',{...req,intent:'acknowledgePvpTurnStart'});
  const conflict=await actor.until(m=>m.type==='intent-result'&&m.code==='ACTION_ID_CONFLICT');
  assert.equal(conflict.ok,false);assert.equal(conflict.snapshot.match.revision,initialRevision+1);
  actor.send('runtime-intent',{clientActionId:'step1.stale.2',baseRevision:initialRevision,intent:'advancePhase',args:[]});
  const stale=await actor.until(m=>m.clientActionId==='step1.stale.2');
  assert.equal(stale.ok,false);assert.equal(stale.code,'STALE_REVISION');
  console.log('PASS duplicate idempotency, conflict ID rejection and stale revision');
  // A new connection owning the same verified seat replaces the old socket.
  const replacement=await connect(actor.id,'player',actor.msgs[0].local.seatToken);
  try{
   assert.equal(replacement.msgs[0].local.seat,actor.msgs[0].local.seat);
   // Replaced sockets must not have access to the mutable seat, whether
   // their transport closes immediately or they had buffered frames.
   try{actor.send('runtime-intent',{clientActionId:'step1.stale-socket.9',baseRevision:initialRevision+1,
     intent:'advancePhase',args:[]})}catch{}
   replacement.send('resync'); const current=await replacement.until(m=>m.forceImport&&m.match?.status==='started');
   assert.equal(current.match.revision,initialRevision+1);
   console.log('PASS verified seat reconnect does not authorize a stale socket');
   const concede={clientActionId:'step1.concede.010',baseRevision:current.match.revision};
   replacement.send('surrender-match',concede);
   const ended=await replacement.until(m=>m.type==='intent-result'&&m.clientActionId===concede.clientActionId);
   assert.equal(ended.ok,true,'A seat may concede despite no active-turn ownership');
   assert.equal(ended.snapshot.match.status,'finished');
   const finalRevision=ended.appliedRevision;
   const beforeReplay=replacement.msgs.filter(m=>m.type==='intent-result'&&m.clientActionId===concede.clientActionId).length;
   replacement.send('surrender-match',concede);
   const settled=await wait(()=>replacement.msgs.filter(m=>m.type==='intent-result'&&m.clientActionId===concede.clientActionId).length>beforeReplay?
    replacement.msgs.filter(m=>m.type==='intent-result'&&m.clientActionId===concede.clientActionId).at(-1):null);
   assert.equal(settled.ok,true,'Lost-ACK replay must remain idempotent after FINISHED');
   assert.equal(settled.appliedRevision,finalRevision);
   assert.equal(settled.snapshot.match.revision,finalRevision,'Replay must not apply concession twice');
   replacement.send('runtime-intent',{clientActionId:'step1.finished.011',baseRevision:finalRevision,intent:'advancePhase',args:[]});
   const afterFinished=await replacement.until(m=>m.type==='intent-result'&&m.clientActionId==='step1.finished.011');
   assert.equal(afterFinished.ok,false,'New actions forbidden after FINISHED');
   assert.equal(afterFinished.snapshot.match.revision,finalRevision);
   console.log('PASS lost surrender ACK replay after finished cannot mutate twice');
  } finally {replacement.ws.close()}
 } finally {a.ws.close();b.ws.close();spec.ws.close()}
} finally {processHandle.kill('SIGTERM')}
