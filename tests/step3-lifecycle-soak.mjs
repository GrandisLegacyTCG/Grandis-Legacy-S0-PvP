/** STEP3: 20 real two-seat local WS match lifecycles and server RSS sampling. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {setTimeout as wait} from 'node:timers/promises';
const build='gl-s0-pvp-rc42-r398-r40-20261124-s3';
const port=25800+Math.floor(Math.random()*900);
const rounds=Number(process.env.PVP_SOAK_ROUNDS||20);
const child=spawn(process.execPath,process.env.PVP_SOAK_FORCE_GC==='1'?['--expose-gc','tests/step3-probed-server.mjs']:['server.js'],{cwd:process.cwd(),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),IDLE_SWEEP_MS:'20000'},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',d=>logs+=d.toString());child.stderr.on('data',d=>logs+=d.toString());
async function until(check,max=10000){const t=Date.now()+max;while(Date.now()<t){const x=check();if(x)return x;await wait(10)}throw Error('Timeout after '+max+'ms '+logs.slice(-800));}
function rss(){try{const s=readFileSync('/proc/'+child.pid+'/status','utf8');return Number(s.match(/^VmRSS:\s+(\d+) kB/m)?.[1]||0)/1024}catch{return null}}
async function join(id){
 const ws=new WebSocket('ws://127.0.0.1:'+port+'/ws?'+new URLSearchParams({client:id,name:id,role:'player',buildId:build}));
 const msgs=[];ws.addEventListener('message',e=>{try{msgs.push(JSON.parse(String(e.data)))}catch{}});
 await new Promise((yes,no)=>{ws.addEventListener('open',yes,{once:true});ws.addEventListener('error',no,{once:true})});
 await until(()=>msgs.some(m=>m.type==='snapshot'&&m.local?.role==='player'));
 return{ws,msgs,send(type,params={}){ws.send(JSON.stringify({type,clientBuildId:build,...params}))},
  async act(type,params,check,limit=10000){const from=msgs.length;this.send(type,params);return until(()=>msgs.slice(from).find(check),limit)} };
}
try{
 await until(()=>logs.includes('Listening'),25000);
 const health=await(await fetch(`http://127.0.0.1:${port}/health`)).json();
 assert.equal(health.buildId,build);
 const p1=await join('step3-lifecycle-a'),p2=await join('step3-lifecycle-b');
 let totalActions=0,maxAckMs=0;const readings=[],startup=[];
 try{
  const a=await p1.act('set-deck',{deckKey:'s0_starter_01_blue_red'},m=>m.type==='snapshot'&&m.local?.deckKey==='s0_starter_01_blue_red');
  await p2.act('set-deck',{deckKey:'s0_starter_02_yellow_blue'},m=>m.type==='snapshot'&&m.local?.deckKey==='s0_starter_02_yellow_blue');
  for(let round=1;round<=rounds;round++){
   await p1.act('ready',{ready:true},m=>m.type==='snapshot'&&m.local?.ready===true);
   await p2.act('ready',{ready:true},m=>m.type==='snapshot'&&m.local?.ready===true);
   const startedAt=performance.now();
   const flip=await p1.act('start-match',{},m=>m.type==='snapshot'&&m.match?.status==='coin-flip',30000);
   await p2.act('choose-coin-flip',{choice:'HEADS'},m=>m.type==='snapshot'&&m.match?.status==='coin-result');
   const win=flip.match?.winnerSeat??0;
   // WINNER seat must be taken from coin-result (the coin-flip snapshot has no winner).
   const result=p1.msgs.filter(m=>m.type==='snapshot'&&m.match?.status==='coin-result').at(-1);
   const winner=result.match.winnerSeat===1?p1:p2;
   winner.send('choose-turn-order',{order:'FIRST'});
   const beforeStart=p1.msgs.length;
   p1.send('coin-presented');p2.send('coin-presented');
   const started=await until(()=>p1.msgs.slice(beforeStart).find(m=>m.type==='snapshot'&&m.match?.status==='started'),12000);
   const seat=started.match.firstSeat===1?p1:p2;
   const r0=started.match.revision;
   const actionId='soak.'+round+'.advance';
   const perfStart=performance.now();
   const advanced=await seat.act('runtime-intent',{intent:'advancePhase',args:[],baseRevision:r0,clientActionId:actionId},m=>m.type==='intent-result'&&m.clientActionId===actionId);
   assert.equal(advanced.ok,true,'advancePhase round '+round+': '+advanced.message);
   totalActions++;
   maxAckMs=Math.max(maxAckMs,performance.now()-perfStart);
   const concedeId='soak.'+round+'.surrender';
   const loser=seat===p1?p2:p1;
   const conceded=await loser.act('surrender-match',{clientActionId:concedeId,baseRevision:advanced.appliedRevision},m=>m.type==='intent-result'&&m.clientActionId===concedeId);
   assert.equal(conceded.ok,true,'surrender round '+round+': '+conceded.message);
   totalActions++;
   assert.equal(conceded.snapshot.match.status,'finished');
   const reset=await p1.act('return-to-lobby',{},m=>m.type==='snapshot'&&m.match?.status==='setup');
   assert.equal(reset.match.board,null);
   assert.equal(reset.local.ready,false);
   const elapsed=Math.round(performance.now()-startedAt);
   startup.push(elapsed);
   if(process.env.PVP_SOAK_FORCE_GC==='1'&&round%5===0){
    const seen=(logs.match(/STEP3_MEM /g)||[]).length;
    child.kill('SIGUSR2');
    await until(()=>(logs.match(/STEP3_MEM /g)||[]).length>seen,3000);
   }
   readings.push({round,rssMB:rss(),elapsedMs:elapsed});
  }
  p1.send('resync');p2.send('resync');
  console.log(JSON.stringify({pass:true,rounds,mutatingActions:totalActions,transport:health.transport,
    rssMB:{first:readings[0].rssMB,last:readings.at(-1).rssMB,max:Math.max(...readings.map(x=>x.rssMB))},
    matchTimeMs:{median:startup.slice().sort((a,b)=>a-b)[Math.floor(startup.length/2)],max:Math.max(...startup)},
    maxAckMs:Math.round(maxAckMs),measurements:readings},null,2));
 }finally{p1.ws.close();p2.ws.close()}
}finally{child.kill('SIGTERM')}
