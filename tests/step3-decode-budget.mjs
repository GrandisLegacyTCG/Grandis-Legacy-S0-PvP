/** STEP3: deterministic decode concurrency/memory tier; preserve visible-card priority. */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../public/battle/runtime/pvp-artwork-loader.js',import.meta.url),'utf8');
function scenario({memory,maxTouchPoints,saveData,expectCap}){
 const on=new Map();const created=[];let active=0,max=0;
 class ImageMock{
  constructor(){this.naturalWidth=96;this.complete=false;created.push(this)}
  set src(url){this.url=url;this.complete=false;active++;max=Math.max(max,active)}
  decode(){return Promise.resolve()}
  finish(){this.complete=true;this.onload?.();active--}
 }
 const ctx={window:null,globalThis:null,navigator:{deviceMemory:memory,maxTouchPoints,connection:{saveData}},
  document:{baseURI:'https://sample.invalid/pvp/battle/',visibilityState:'visible',querySelectorAll:()=>[]},
  Image:ImageMock,Map,Set,URL,Promise,Math,Object,console,
  setTimeout:()=>1,clearTimeout:()=>{},addEventListener(name,fn){on.set(name,fn)}};
 ctx.window=ctx;ctx.globalThis=ctx;
 vm.runInNewContext(src,ctx);
 const loader=ctx.GL_PVP_ARTWORK;
 assert.equal(loader.diagnostics().capacity,expectCap);
 const jobs=[];
 for(let i=0;i<19;i++)jobs.push(loader.load('/card-art/S0-CLE-'+String(i).padStart(3,'0')+'.webp',{priority:i%3===0?'hero':'background'}));
 assert.equal(created.length,expectCap,'Decode must never eagerly create 19 Image objects');
 assert.equal(loader.diagnostics().active,expectCap);
 return {created,loader,jobs,ctx,max};
}
for(const args of [
 {memory:2,maxTouchPoints:5,saveData:false,expectCap:2},
 {memory:4,maxTouchPoints:5,saveData:false,expectCap:3},
 {memory:8,maxTouchPoints:0,saveData:false,expectCap:6},
 {memory:8,maxTouchPoints:0,saveData:true,expectCap:2}
]){
 const p=scenario(args);
 // Complete the images in batches to verify the queue advances without extra decodes.
 let index=0;
 while(index<19){
  const chunk=p.created.slice(index);
  assert.ok(chunk.length>0,'Jobs must continue once capacity is released');
  for(const im of chunk)im.finish();
  index+=chunk.length;
  await new Promise(r=>setImmediate(r));
 }
 assert.equal((await Promise.all(p.jobs)).filter(Boolean).length,19);
 assert.equal(p.loader.diagnostics().active,0);
 assert.equal(p.loader.diagnostics().queued,0);
 assert.equal(p.loader.diagnostics().ready,19);
 console.log(`PASS STEP3 decode tier ${args.memory}GB touch=${args.maxTouchPoints} saveData=${args.saveData} max=${args.expectCap}`);
}
