/** UI SYNC: latest VS AI 250 self-contained miniature bytes, with optional separate WebP assets. */
import assert from 'node:assert/strict';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const root=resolve(new URL('..',import.meta.url).pathname);
const file=join(root,'public/battle/runtime/pvp-card-thumbnails.js');
const js=readFileSync(file,'utf8');
assert.ok(statSync(file).size>800000&&statSync(file).size<1300000,'Instant VS AI thumbnail table should be about 1MB');
assert.match(js,/data:image\/webp;base64/,'No self-contained exact-card thumbnails');
const w={};vm.runInNewContext(js,{window:w});
const thumbs=w.GL_PVP_CARD_THUMBNAILS;
assert.equal(Object.keys(thumbs).length,250);
assert.equal(w.GL_PVP_CARD_THUMBNAIL_MANIFEST.count,250);
const hashes=JSON.parse(readFileSync(join(root,'tests/fixtures/step3-thumb-byte-hashes.json'),'utf8'));
const website=process.env.PVP_WEBSITE_ROOT;
for(const [id,src] of Object.entries(thumbs)){
 assert.ok(src.startsWith('data:image/webp;base64,'),'Missing always-ready miniature '+id);
 const bin=Buffer.from(src.split(',')[1],'base64');
 const assetPath='battle/assets/thumbnails/'+id+'.webp';
 assert.deepEqual(readFileSync(join(root,'public',assetPath)),bin,'Separate webp differs from bundled miniature');
 assert.equal(bin.toString('latin1',0,4),'RIFF');
 assert.equal(bin.toString('latin1',8,12),'WEBP');
 assert.equal(createHash('sha256').update(bin).digest('hex'),hashes[id],'Exact thumbnail changed '+id);
 if(website){
  const wpath=join(website,assetPath);
  assert.ok(existsSync(wpath),'Website thumbnail 404 '+id);
  assert.deepEqual(readFileSync(wpath),bin,'Website thumbnail mismatch '+id);
 }
}
if(website){
 assert.equal(readFileSync(join(website,'battle/runtime/pvp-card-thumbnails.js'),'utf8'),js,'Website mapping differs');
}
console.log('PASS UI SYNC thumbnails: 250/250 current VS AI exact-card miniature bytes, immediate self-contained fallback, standalone + Website parity');
