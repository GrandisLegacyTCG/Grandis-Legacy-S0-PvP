/** Verify Docker/native ws health using the frontend's actual paired build ID. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {setTimeout as sleep} from 'node:timers/promises';
const ctx={window:{}};
vm.runInNewContext(readFileSync(new URL('../public/build-meta.js',import.meta.url),'utf8'),ctx);
const expected=ctx.window.GL_PVP_BUILD_META?.buildId;
assert.match(String(expected),/^gl-s0-pvp-rc[0-9]+-[a-z0-9-]+$/,'Unknown PvP frontend build');
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
assert.equal(health.buildId,expected,'Docker/Website build mismatch');
const expectedVersion=/const VERSION='([^']+)'/.exec(readFileSync(new URL('../server.js',import.meta.url),'utf8'))?.[1];
assert.ok(expectedVersion,'Server version missing');
assert.equal(health.version,expectedVersion,'Docker server version mismatch');
console.log('PASS Docker native ws health and matched paired build '+expected);
