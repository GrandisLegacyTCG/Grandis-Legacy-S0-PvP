// Tests the *actual* standalone Node HTTP server with hydrated asset paths.
// No GitHub, Northflank or external internet is used.
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest=JSON.parse(await readFile(path.join(root,'scripts/asset-dedup-manifest.json'),'utf8'));
let port=await new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))});});
let child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',PVP_REQUIRE_WS:'0'},stdio:'ignore'});
const base=`http://127.0.0.1:${port}`;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function get(p,options={}){return await fetch(new URL(p,base),{...options,signal:AbortSignal.timeout(16000)});}
try{
  let health;
  for(let i=0;i<60;i++){
    if(child.exitCode!==null)throw new Error('Server exited unexpectedly '+child.exitCode);
    try{const r=await get('/health');if(r.ok){health=await r.json();break}}catch{}
    await delay(200);
  }
  assert.equal(health?.ok,true);
  let checked=0;
  for(const group of manifest.groups){
    for(const alias of group.aliases){
      const r=await get('/'+alias.replace(/ /g,'%20'),{method:'HEAD'});
      assert.equal(r.status,200,'HEAD alias '+alias);
      assert.equal(Number(r.headers.get('content-length')),group.bytes,'size '+alias);
      checked++;
    }
  }
  assert.equal(checked,manifest.replacedAssetFiles);
  // Byte-for-byte HTTP validation across major categories, including range audio.
  const samples=manifest.groups.filter(g=>/Background\.png|Tavern Quest\.mp3|NotoSans-Variable\.woff2|Swap\.png|Counter\.png|S0-ARC-H003\.webp|back-main\.webp|M\.Defense\.png/.test(g.canonical));
  assert.ok(samples.length>=6);
  for(const group of samples){
    const r=await get('/pvp/'+group.aliases[0].replace(/ /g,'%20'));
    assert.equal(r.status,200,'GET alias '+group.aliases[0]);
    const digest=createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex');
    assert.equal(digest,group.sha256,'bytes '+group.aliases[0]);
  }
  const audio=manifest.groups.find(g=>g.canonical.endsWith('Tavern Quest.mp3'));
  if(audio){
    const r=await get('/'+audio.aliases[0].replace(/ /g,'%20'),{headers:{Range:'bytes=0-99'}});
    assert.equal(r.status,206);assert.equal((await r.arrayBuffer()).byteLength,100);
  }
  console.log(`PASS Asset dedup HTTP: ${checked} URLs/HEAD, ${samples.length} full-byte GET, audio Range, /pvp routing, /health`);
}finally{
  child.kill('SIGTERM');
  await new Promise(resolve=>{if(child.exitCode!==null||child.signalCode!==null)return resolve();const t=setTimeout(resolve,4000);child.once('exit',()=>{clearTimeout(t);resolve()})});
}
