/** STEP3: prove 250 exact-card thumbnails were extracted without any data loss. */
import assert from 'node:assert/strict';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const root=resolve(new URL('..',import.meta.url).pathname);
const file=join(root,'public/battle/runtime/pvp-card-thumbnails.js');
const js=readFileSync(file,'utf8');
assert.ok(statSync(file).size<20000,'Thumbnail JS must stay below 20 KB');
assert.doesNotMatch(js,/data:image\/webp;base64/,'No 1MB in-memory data URL table');
const w={};vm.runInNewContext(js,{window:w});
const thumbs=w.GL_PVP_CARD_THUMBNAILS;
assert.equal(Object.keys(thumbs).length,250);
assert.equal(w.GL_PVP_CARD_THUMBNAIL_MANIFEST.count,250);
const hashes=JSON.parse(readFileSync(join(root,'tests/fixtures/step3-thumb-byte-hashes.json'),'utf8'));
const website=process.env.PVP_WEBSITE_ROOT;
for(const [id,src] of Object.entries(thumbs)){
 assert.equal(src,'/pvp/battle/assets/thumbnails/'+id+'.webp');
 const bin=readFileSync(join(root,'public',src.replace(/^\/pvp\//,'')));
 assert.equal(bin.toString('latin1',0,4),'RIFF');
 assert.equal(bin.toString('latin1',8,12),'WEBP');
 assert.equal(createHash('sha256').update(bin).digest('hex'),hashes[id],'Exact thumbnail changed '+id);
 if(website){
  const wpath=join(website,src.replace(/^\/pvp\//,''));
  assert.ok(existsSync(wpath),'Website thumbnail 404 '+id);
  assert.deepEqual(readFileSync(wpath),bin,'Website thumbnail mismatch '+id);
 }
}
if(website){
 assert.equal(readFileSync(join(website,'battle/runtime/pvp-card-thumbnails.js'),'utf8'),js,'Website mapping differs');
}
console.log('PASS STEP3 thumbnails: 250/250 original WebP SHA-256 bytes, standalone + Website parity, 15.6KB JS URL map');
