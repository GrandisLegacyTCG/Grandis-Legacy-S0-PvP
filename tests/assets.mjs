import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
const root=resolve(process.cwd(),'public');
const docPaths=['index.html','battle/index.html'];
const missing=[];let count=0;
for(const doc of docPaths){
 const html=readFileSync(join(root,doc),'utf8');
 for(const m of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi)){
  const ref=m[1].split(/[?#]/)[0];
  if(!ref||/^(?:https?:|data:|blob:|\/\/)/i.test(ref)||ref==='/build-meta.js'||ref==='build-meta.js')continue;
  const target=ref.startsWith('/')?resolve(root,'.'+ref):resolve(root,dirname(doc),ref);
  if(!target.startsWith(root+'/')&&!target.startsWith(root+'\\'))throw new Error('Asset escapes public root: '+ref);
  if(!existsSync(target))missing.push(`${doc}: ${ref}`);else count++;
 }
}
assert.deepEqual(missing,[],'A production script or stylesheet is missing');
const artwork=readdirSync(join(root,'battle/card-art')).filter(x=>/^S0-.*\.webp$/.test(x));
assert.equal(artwork.length,250,'Season 0 original artwork count');
const thumbs=readdirSync(join(root,'battle/assets/thumbnails')).filter(x=>/^S0-.*\.webp$/.test(x));
assert.deepEqual(thumbs.sort(),artwork.sort(),'Exact-card thumbnail coverage');
for(const effect of ['Cleanse','Invincible','Negate','Reflect','Revive'])assert.ok(existsSync(join(root,'engine/assets/battle',effect+'.png')),'Missing VFX '+effect);
for(const effect of ['Invincible','Negate','Reflect','Revive'])assert.ok(existsSync(join(root,'engine/assets/audio/battle',effect+'.mp3')),'Missing SFX '+effect);
for(const p of [
 'assets/lobby/grandis-legacy-logo.webp','engine/assets/lobby/Swap.png',
 'battle/engine/assets/audio/Card Sound.mp3','battle/engine/assets/audio/battle/P.Atk.mp3',
 'battle/engine/assets/audio/battle/M.Atk.mp3','battle/assets/ui/back-shard.webp',
 ...['Racial Beastman Button.png','Racial Dragonborn Button.png','Racial Dwarf Button.png',
 'Racial Elf Button.png','Racial Halfling Button.png','Racial Human Button.png',
 'Racial Legacy Button.png','Support Button.png'].map(n=>'battle/assets/ui/hero-actions/'+n)
])assert.ok(existsSync(join(root,p)),'Essential artwork/audio missing: '+p);
console.log('PASS required root + battlefield scripts/styles ('+count+') and S0 card art ('+artwork.length+')');
// Current release cannot start with a missing or superseded card data layer.
const {default:vm}=await import('node:vm');
const {createHash}=await import('node:crypto');
const gen='battle/runtime/season0-generated/';
const ctx={window:{}};
for(const f of ['rc44-main-deck-r40-active.js','rc44-card-review-current.js'])vm.runInNewContext(readFileSync(join(root,gen,f),'utf8'),ctx);
const live=ctx.window;
for(const [key,n] of Object.entries({GL_RC44_APPROVED_PRINT_BASELINE:38,GL_RC44_MAINDECK_OVERLAY:49,GL_RC44_NEW_MAIN_CARDS:2,GL_RC44_MAIN_CARD_ASSETS:244,GL_DB166_REVIEW_CARDS:244}))assert.equal(Object.keys(live[key]).length,n,key);
assert.deepEqual(Object.keys(live.GL_DB166_REVIEW_CARDS).sort(),Object.keys(live.GL_RC44_MAIN_CARD_ASSETS).sort());
for(const [id,hash] of Object.entries(live.GL_RC44_MAIN_CARD_ASSETS))assert.equal(createHash('sha256').update(readFileSync(join(root,'battle/card-art',id+'.webp'))).digest('hex'),hash,id);
assert.equal(live.GL_DB166_REVIEW_CARDS['S0-MAG-028'].name,'Intimidate');
assert.match(live.GL_DB166_REVIEW_CARDS['S0-MAG-026'].text,/MANA BURN 2/);
assert.equal(live.GL_DB166_REVIEW_CARDS['S0-THF-026'].cost,'4 Mana');
assert.match(live.GL_DB166_REVIEW_CARDS['S0-WAR-026'].text,/60 PIERCING/);
assert.doesNotMatch(live.GL_DB166_REVIEW_CARDS['S0-ARC-024'].rows[0].text,/RANGE/);
const loaders=docPaths.map(doc=>readFileSync(join(root,doc),'utf8')).concat(readFileSync(join(root,'../server/headless-rc32.mjs'),'utf8')).join('\n');
assert.doesNotMatch(loaders,/rc41-approved-print-overrides\.js|rc42-main-deck-r398-overlay\.js|rc44-main-deck-r40-overlay\.js|grand-finale-designer-nerf\.js|db166-view-model\.js|s0-lobby-card-definitions\.js|s0-lobby-review-catalog\.js/);
assert.match(loaders,/rc44-main-deck-r40-active\.js/);
assert.match(readFileSync(join(root,'battle/engine/shared-app/app.bundle.js'),'utf8'),/refusing old-effect fallback/);
console.log('PASS RC44 active card snapshot, current Review registry, artwork hashes and retired-loader guard');
