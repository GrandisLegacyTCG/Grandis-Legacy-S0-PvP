// Release gate: tests current RC41 source and surviving PvP network/visual regressions.
// Historical RC40 SHA and R3.7 card-print fixtures are kept, not repurposed as RC41.
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const checks=[
 'node tests/rc41-seat-mirror-mana.mjs',
 'node tests/s1-source-parity.mjs',
 'node tests/s0-catalog-static.mjs',
 'node tests/lobby-init.mjs',
 'node tests/http-static.mjs',
 'node tests/privacy-presentation.mjs',
 'node tests/intent-id-uniqueness.mjs',
 'node tests/asset-integrity.mjs',
 'node tests/rc34-engine-regression.cjs',
 'node tests/rc34-atomic-mana.cjs',
 'node tests/rc34-seat2-payment-response.mjs',
 'node tests/rc34-deadlock-engine.mjs',
 'python3 tests/rc34-deadlock-ws.py',
 'node tests/rc34-network-ack-race.mjs',
 'node tests/rc34-opening-watchdog.mjs',
 'node tests/rc34-response-browser-gate.mjs',
 'python3 tests/rc34-postmatch-cleanup.py',
 'node tests/rc34-touch-static.mjs',
 'node tests/rc34-rc4-quickplay-tuneup.mjs',
 'node tests/rc34-rc5-mana-transport.mjs',
 'node tests/net-rc6-transport.mjs',
 'node tests/net-rc6-stage2-single-socket.mjs',
 'node tests/net-rc6-stage2-battle-bridge.mjs',
 'node tests/rc36-ui-hotfix.mjs',
 'node tests/rc36-patch6-defense-source.mjs',
 'node tests/rc36-mobile-waiting.mjs',
 'node tests/rc38-combat-hotfix.mjs',
 'node tests/rc38-coin-turn.mjs',
 'node tests/rc38-lobby-batch1.mjs',
 'node tests/rc38-startup-batch2.mjs',
 'node tests/rc38-battle-warmframe-batch2.mjs',
 'node tests/rc38-local-choice-batch3.mjs',
 'node tests/rc38-local-draft-real-engine-batch3.mjs',
 'node tests/rc38-batch4-mana-source-sync.mjs',
 'node tests/rc39-batch5-rank-privacy.mjs',
 'node tests/rc39-batch5-mana-loss.mjs',
 'node tests/rc39-latest-banner-qa.mjs',
 'node tests/rc39-rc2-combat-ui.mjs',
 'node tests/rc39-rc3-ui-parity.mjs',
 'node tests/rc39-rc4-blind-mana-and-cancel.mjs',
 'node tests/rc8-vsai-parity-focused.mjs',
 'node tests/rc9-stage1-response.cjs',
 'node tests/rc9-stage2-match-history.mjs',
 'node tests/rc9-stage3-ui-legacy.mjs',
 'node tests/rc9-p3-hotfix.mjs',
 'node tests/rc40-stage1-burn-pvp.cjs',
 'node tests/rc40-stage3-website-ui.mjs',
 'node tests/rc40-p32-battlefield-hand-artwork.mjs',
 'node tests/rc40-item-arrow-paladin-regression.mjs',
 'node tests/rc40-standalone-smoke.mjs'
];
// Avoid spawnSync's pipe/descendant deadlock: a timed-out Python test may
// start a child server which retains OS pipe descriptors after its parent exits.
// The historical set and 45-second per-case watchdog remain unchanged.
function runCommand(command){
 return new Promise(resolve=>{
  const [binary,...args]=command.split(' '),started=Date.now();
  const child=spawn(binary,args,{cwd:process.cwd(),stdio:['ignore','pipe','pipe'],detached:true});
  let stdout='',stderr='',finished=false,timedOut=false,overflow=false;
  const finish=(status)=>{
   if(finished)return;finished=true;clearTimeout(watchdog);
   child.stdout?.destroy();child.stderr?.destroy();
   resolve({command,status,duration_ms:Date.now()-started,
     tail:stdout.slice(-700),error:stderr.slice(-600)});
  };
  function capture(stream,isErr){
   stream.on('data',chunk=>{
    const s=String(chunk);
    if((isErr?stderr:stdout).length+s.length>8*1024*1024){
     overflow=true;try{process.kill(-child.pid,'SIGKILL')}catch{};
     finish('OUTPUT_TOO_LARGE');return;
    }
    if(isErr)stderr+=s;else stdout+=s;
   });
  }
  capture(child.stdout,false);capture(child.stderr,true);
  child.once('error',err=>{stderr+='\n'+String(err);finish('SPAWN_ERROR')});
  // `exit` resolves on the process itself; `close` can hang on inherited FDs.
  child.once('exit',(code,signal)=>finish(timedOut?'TIMEOUT':(overflow?'OUTPUT_TOO_LARGE':(signal||code))));
  const watchdog=setTimeout(()=>{
   timedOut=true;
   try{process.kill(-child.pid,'SIGKILL')}catch{try{child.kill('SIGKILL')}catch{}}
   finish('TIMEOUT');
  },45000);
 });
}
const results=[];
for(const [i,command] of checks.entries()){
 const result=await runCommand(command);
 results.push(result);
 console.log(`[${i+1}/${checks.length}] ${result.status===0?'PASS':'FAIL'} ${command} (${result.duration_ms}ms)`);
 if(result.status!==0){console.error(result.tail,result.error);break;}
}
writeFileSync('docs/RC41_RELEASE_GATE_RESULTS.json',JSON.stringify({count:results.length,total:checks.length,pass:results.every(r=>r.status===0)&&results.length===checks.length,results},null,2)+'\n');
if(!results.every(r=>r.status===0)||results.length!==checks.length){process.exitCode=1;}
else console.log(`PASS RC41 multiplayer/historical compatibility release gate: ${results.length}/${checks.length} independent tests`);
