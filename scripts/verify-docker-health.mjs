/** Verify Docker/native ws health using the frontend's actual paired build ID. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {setTimeout as sleep} from 'node:timers/promises';
const ctx={window:{}};
vm.runInNewContext(readFileSync(new URL('../public/build-meta.js',import.meta.url),'utf8'),ctx);
const expected=ctx.window.GL_PVP_BUILD_META?.buildId;
assert.match(String(expected),/^gl-s0-pvp-rc42-r398-r40-20261124-[a-z0-9-]+$/,'Unknown PvP frontend build');
const url='http://127.0.0.1:'+String(process.env.PVP_QA_PORT||'3066')+'/health';
let health,lastError;
for(let i=0;i<25;i++){
 try{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),2000);
  try{const r=await fetch(url,{signal:controller.signal});if(r.ok){health=await r.json();break}lastError=new Error('HTTP '+r.status)}
  finally{clearTimeout(timer)}
 }catch(e){lastError=e}
 await sleep(300);
}
assert.ok(health,'Docker health unavailable '+String(lastError||''));
assert.equal(health.ok,true,'Backend unhealthy');
assert.equal(health.transport,'ws','Docker requires native ws, never ws-lite');
assert.equal(health.buildId,expected,'Docker/Website S3 build mismatch');
assert.equal(health.version,'S0-RC42-PVP-NET-RC6-STAGE2-INTEGRATION-1','Unapproved PvP transport version');
console.log('PASS Docker native ws health and matched paired build '+expected);
