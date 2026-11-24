/**
 * Post-deployment read-only PvP endpoint smoke test for Northflank.
 * CI can point GL_PVP_BACKEND_URL to the native-ws Docker service localhost.
 * Tests /health and the actual /ws handshake from the production Website Origin.
 * Does not join either player seat or execute gameplay actions.
 *
 * Run after owner manually deploys:
 *   GL_PVP_BACKEND_URL=https://<northflank-service> npm run smoke:northflank
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import WebSocket from 'ws';
const DEFAULT='https://p01--grandis-legacy-s0-pvp--2kwws8nzlcc2.code.run';
const BACKEND=String(process.env.GL_PVP_BACKEND_URL||DEFAULT).replace(/\/+$/,'');
const WEBSITE_ORIGIN=String(process.env.GL_PVP_WEBSITE_ORIGIN||'https://grandislegacytcg.web.id');
const BUILD_ID='gl-s0-pvp-rc42-r398-r40-20261124-b';
const base=new URL(BACKEND);
assert.ok(base.protocol==='https:' || (base.protocol==='http:' && /^(localhost|127\.0\.0\.1)$/.test(base.hostname)),
  'Production health must use HTTPS; plain HTTP is allowed only on localhost for Docker CI.');
assert.ok(!base.pathname || base.pathname==='/', 'GL_PVP_BACKEND_URL must be an origin URL, without a route path');
const healthUrl=new URL('/health',base);
const controller=new AbortController();
const timeout=setTimeout(()=>controller.abort(new Error('Northflank health timeout')),9000);
let health;
try {
  const response=await fetch(healthUrl,{signal:controller.signal,headers:{'accept':'application/json'}});
  assert.equal(response.status,200,`Health returned HTTP ${response.status}`);
  health=await response.json();
} finally {clearTimeout(timeout)}
assert.equal(health.ok,true,'Backend health is not OK');
assert.equal(health.transport,'ws','Production must use native ws, not lite fallback');
assert.equal(health.buildId,BUILD_ID,'Website/backend client build mismatch');
const wsUrl=new URL('/ws',base);wsUrl.protocol=base.protocol==='https:'?'wss:':'ws:';
wsUrl.searchParams.set('client','qa-northflank-'+randomUUID());
wsUrl.searchParams.set('name','Read-only PvP QA');
wsUrl.searchParams.set('role','spectator');
wsUrl.searchParams.set('buildId',BUILD_ID);
await new Promise((resolve,reject)=>{
  const ws=new WebSocket(wsUrl,{origin:WEBSITE_ORIGIN,handshakeTimeout:9000});
  const deadline=setTimeout(()=>finish(new Error('WebSocket snapshot timeout')),9000);
  let finished=false;
  function finish(error){
    if(finished)return;finished=true;clearTimeout(deadline);
    ws.removeAllListeners('error');ws.removeAllListeners('message');ws.removeAllListeners('close');
    try{ws.close(1000,'QA completed')}catch{}
    if(error)reject(error);else resolve();
  }
  ws.on('error',finish);
  ws.on('close',(code,reason)=>finish(new Error('WebSocket closed before snapshot: '+code+' '+String(reason))));
  ws.on('message',raw=>{
    try{
      const m=JSON.parse(String(raw));
      if(m.type==='error')return finish(new Error('WebSocket rejected: '+m.code+' '+m.message));
      if(m.type!=='snapshot')return;
      assert.equal(m.buildId,BUILD_ID,'Snapshot build mismatch');
      assert.equal(m.local?.role,'spectator','QA unexpectedly occupied a player seat');
      finish();
    }catch(e){finish(e)}
  });
});
console.log('PASS Northflank native ws HTTP/WSS endpoint, matched build, production Origin, spectator snapshot: '+BACKEND);
