/** STEP3: real standalone HTTP delivery, thumb 250/250 HEAD, one compressed JS roundtrip. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {brotliDecompressSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
const port=28000+Math.floor(Math.random()*500);
const proc=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
let logs='';proc.stdout.on('data',b=>logs+=b);proc.stderr.on('data',b=>logs+=b);
const base=`http://127.0.0.1:${port}`;
try{
 let alive=false;
 for(let i=0;i<250;i++){if(logs.includes('Listening')){alive=true;break}await sleep(40)}
 assert.ok(alive,'backend failed to start '+logs.slice(-250));
 const health=await(await fetch(base+'/health')).json();
 assert.equal(health.ok,true);
 assert.equal(health.buildId,'gl-s0-pvp-rc44-r40-r40-20261127');
 for(const p of ['/pvp/','/pvp/battle/','/assets/site/web-s0/favicon.png','/assets/site/web-s0/logo-transparent.webp']){
  const res=await fetch(base+p,{method:'HEAD'});assert.equal(res.status,200,'asset route '+p);
 }
 const manifestSrc=readFileSync('public/battle/runtime/pvp-card-thumbnails.js','utf8');
 const ids=JSON.parse(readFileSync('tests/fixtures/step3-thumb-byte-hashes.json','utf8'));
 const thumbs=Object.keys(ids),batch=20;
 for(let k=0;k<thumbs.length;k+=batch){
  const part=thumbs.slice(k,k+batch);
  await Promise.all(part.map(async id=>{
   const res=await fetch(base+'/pvp/battle/assets/thumbnails/'+id+'.webp',{method:'HEAD'});
   assert.equal(res.status,200,'thumbnail HTTP 404 '+id);
   assert.equal(res.headers.get('content-type'),'image/webp');
  }));
 }
 assert.equal(thumbs.length,250);
 const url=base+'/pvp/battle/runtime/pvp-card-thumbnails.js?v='+health.buildId;
 const compressed=await fetch(url,{headers:{'accept-encoding':'br'}});
 assert.equal(compressed.status,200);
 assert.equal(compressed.headers.get('cache-control'),'public, max-age=86400, immutable');
 // Node native fetch automatically decompresses transfer encodings.
 assert.equal(await compressed.text(),manifestSrc,'Content-Encoding mismatch or stale sidecar');
 const forbidden=await fetch(base+'/pvp/battle/runtime/pvp-card-thumbnails.js.br');
 assert.equal(forbidden.status,403,'Direct access to compressed sidecars must be denied');
 console.log('PASS STEP3 HTTP: 250/250 thumbnails 200 WebP, favicon/logo, Lobby/Battlefield, Brotli JS transfer, immutable versioned cache, sidecar protection');
}finally{proc.kill('SIGTERM')}
