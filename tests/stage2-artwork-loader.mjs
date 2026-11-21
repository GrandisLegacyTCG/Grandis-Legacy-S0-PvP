import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';
const root=process.cwd();
const path=join(root,'public/battle/runtime');
const ticks=new Map(),listeners=new Map(),requestImages=[];
let tickId=0;
const setFakeTimeout=(cb,delay=0)=>{const id=++tickId;ticks.set(id,{cb,delay});return id};
const clearFakeTimeout=id=>ticks.delete(id);
function tick(delay){const next=[...ticks.entries()].find(([,v])=>v.delay===delay);assert.ok(next,`Missing ${delay}ms timer`);ticks.delete(next[0]);next[1].cb();}
class FakeImage{
 constructor(){this.onload=null;this.onerror=null;this.naturalWidth=0;this.complete=false;this.fetchPriority=null;this.decoding=null;requestImages.push(this)}
 set src(value){this._src=value;this.complete=false;this.naturalWidth=0}
 get src(){return this._src}
 decode(){return this.decoder?this.decoder.promise:Promise.resolve()}
 loaded(){this.naturalWidth=512;this.complete=true;this.onload?.()}
 failed(){this.complete=true;this.onerror?.()}
}
const doc={baseURI:'https://game.example/pvp/battle/',querySelectorAll:()=>liveImages.filter(x=>x.dataset.glPvpArtStage==='thumb')};
const liveImages=[];
const ctx={console,URL,Image:FakeImage,document:doc,setTimeout:setFakeTimeout,clearTimeout:clearFakeTimeout};
ctx.window={addEventListener:(name,fn)=>listeners.set(name,fn)};
vm.createContext(ctx);
for(const file of ['pvp-card-thumbnails.js','pvp-artwork-loader.js']){
 vm.runInContext(readFileSync(join(path,file),'utf8'),ctx,{filename:file,timeout:30000});
}
const api=ctx.window.GL_PVP_ARTWORK,faces=ctx.window.GL_PVP_CARD_THUMBNAILS;
const canonical=id=>`https://game.example/pvp/battle/card-art/${id}.webp`;
let passed=0;
const test=(name,fn)=>{fn();++passed;console.log('PASS',name)};
async function flush(){for(let i=0;i<8;i++)await Promise.resolve()}
function mockDomImage(){const img={src:'',dataset:{},classList:{remove(){},add(){}},getAttribute(n){return this[n]}};liveImages.push(img);return img}
test('all approved cards have embedded exact-card thumbnails',()=>{
 assert.equal(Object.keys(faces).length,250);
 for(const [id,thumb] of Object.entries(faces)){
  assert.match(id,/^S0-[A-Z0-9-]+$/);assert.ok(thumb.startsWith('data:image/webp;base64,'),id);
  const bytes=Buffer.from(thumb.split(',')[1],'base64');assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
 }
 assert.equal(ctx.window.GL_PVP_CARD_THUMBNAIL_MANIFEST.count,250);
});
test('cannot preload or reveal an explicitly hidden opponent card',()=>{
 const image=mockDomImage(),n=requestImages.length;
 assert.equal(api.bind(image,{cardId:'S0-ARC-001',src:'card-art/S0-ARC-001.webp',canRevealFace:false}),false);
 assert.equal(requestImages.length,n);assert.equal(image.src,'');
});
{
 const id='S0-ARC-001',img=mockDomImage();
 test('own Hand displays thumbnail synchronously, without waiting for decode',()=>{
  assert.equal(api.bind(img,{cardId:id,src:`card-art/${id}.webp`,priority:'hand'}),true);
  assert.equal(img.src,faces[id]);assert.equal(img.dataset.glPvpArtStage,'thumb');
  assert.equal(requestImages.length,1);assert.equal(requestImages[0].fetchPriority,'high');
 });
 const pending={};pending.promise=new Promise(resolve=>pending.resolve=resolve);
 requestImages[0].decoder=pending;
 requestImages[0].loaded();await flush();
 test('decoded full image never appears before decode completes',()=>assert.equal(img.src,faces[id]));
 pending.resolve();await flush();
 test('full image upgrades the thumbnail after decode',()=>{
  assert.equal(img.src,canonical(id));assert.equal(img.dataset.glPvpArtStage,'full');
 });
 test('unchanged card DOM needs no second image request',()=>{
  const before=requestImages.length;api.bind(img,{cardId:id,src:`card-art/${id}.webp`,priority:'hand'});
  assert.equal(requestImages.length,before);
 });
}
{
 const a='S0-ARC-002',b='S0-ARC-003',img=mockDomImage();
 const oldCount=requestImages.length;
 api.bind(img,{cardId:a,src:`card-art/${a}.webp`});
 api.bind(img,{cardId:b,src:`card-art/${b}.webp`});
 assert.equal(requestImages.length,oldCount+2);
 requestImages[oldCount].loaded();await flush();
 test('late completion for old card never overwrites newer card',()=>{
  assert.equal(img.src,faces[b]);assert.equal(img.dataset.glPvpArtId,b);
 });
 requestImages[oldCount+1].loaded();await flush();
 test('new card upgrades only to its own decoded artwork',()=>assert.equal(img.src,canonical(b)));
}
{
 const id='S0-ARC-004',img=mockDomImage();
 const start=requestImages.length;
 api.bind(img,{cardId:id,src:`card-art/${id}.webp`});
 requestImages[start].failed();tick(300);
 assert.equal(requestImages.length,start+2);
 requestImages[start+1].failed();tick(850);
 assert.equal(requestImages.length,start+3);
 requestImages[start+2].failed();await flush();
 test('three failed full-resolution attempts leave the exact thumbnail',()=>{
  assert.equal(img.src,faces[id]);assert.equal(img.dataset.glPvpArtStage,'thumb');
  assert.equal(api.diagnostics().failed,1);
 });
 listeners.get('online')();
 test('network recovery retries failed original without hiding thumbnail',()=>{
  assert.equal(requestImages.length,start+4);
  assert.equal(img.src,faces[id]);
 });
 requestImages[start+3].loaded();await flush();
 test('post-reconnect decoded full image upgrades normally',()=>{
  assert.equal(img.src,canonical(id));assert.equal(api.diagnostics().failed,0);
 });
}
{
 const id='S0-ARC-006',img=mockDomImage(),start=requestImages.length;
 api.bind(img,{cardId:id,src:`card-art/${id}.webp`});
 const decoder={};decoder.promise=new Promise((resolve,reject)=>{decoder.reject=reject});
 requestImages[start].decoder=decoder;requestImages[start].loaded();await flush();
 decoder.reject(Error('corrupt decoder'));await flush();
 test('decode rejection is a failed load, never a premature artwork promotion',()=>{
  assert.equal(img.src,faces[id]);assert.equal(img.dataset.glPvpArtStage,'thumb');
 });
 tick(300);requestImages[start+1].loaded();await flush();
 test('decode rejection recovers on a later successful retry',()=>assert.equal(img.src,canonical(id)));
}
{
 const id='S0-ARC-005',n=requestImages.length;
 const one=api.load(`card-art/${id}.webp`,{priority:'background'});
 const two=api.load(`card-art/${id}.webp`,{priority:'hand'});
 assert.equal(one,two);
 assert.equal(requestImages.length,n+1);
 requestImages[n].loaded();await flush();
 test('same resource is fetched once and higher-priority clients dedupe',()=>assert.equal(api.diagnostics().active,0));
}
console.log(`STAGE 2 ARTWORK ${passed}/${passed} PASS`);
