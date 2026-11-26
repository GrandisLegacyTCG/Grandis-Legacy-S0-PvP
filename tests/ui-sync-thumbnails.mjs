/** Presentation-only regression contract. No gameplay mutation or backend calls. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const file=path=>readFileSync(new URL('../'+path,import.meta.url));
const bundle=String(file('public/battle/runtime/pvp-card-thumbnails.js'));
const sandbox={window:{}};vm.runInNewContext(bundle,sandbox);
const thumbs=sandbox.window.GL_PVP_CARD_THUMBNAILS;
assert.equal(Object.keys(thumbs).length,250);
assert.equal(sandbox.window.GL_PVP_CARD_THUMBNAIL_MANIFEST.embedded,true);
const expected=JSON.parse(file('tests/fixtures/step3-thumb-byte-hashes.json'));
for(const [id,uri] of Object.entries(thumbs)){
 assert.match(id,/^S0-[A-Z0-9-]+$/);
 assert.match(uri,/^data:image\/webp;base64,/);
 const bytes=Buffer.from(uri.split(',')[1],'base64');
 assert.equal(bytes.toString('latin1',0,4),'RIFF');
 assert.equal(bytes.toString('latin1',8,12),'WEBP');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),expected[id]);
}
const loader=String(file('public/battle/runtime/pvp-artwork-loader.js'));
for(const needle of ['MutationObserver','IntersectionObserver','canRevealFace','deferOriginal','attach(document)','idFromVisibleSrc','image.decode','img.src=thumbnail','event.stopImmediatePropagation?.()','new WeakSet()'])
 assert.ok(loader.includes(needle),'Universal loader missing '+needle);
assert.match(loader,/card-art\\\/\(S0-/);
const lobby=String(file('public/index.html'));
const battle=String(file('public/battle/index.html'));
for(const html of [lobby,battle])for(const name of ['pvp-card-thumbnails.js','pvp-artwork-loader.js'])
 assert.ok(html.includes(name+'?v='+(name==='pvp-card-thumbnails.js'?'20261127-rc44-r40':'20261125-ui-sync1')),'Script not loaded from both pages '+name);
assert.ok(lobby.includes('pvp-ui-sync.css?v=20261125-ui-sync1'));
assert.ok(battle.includes('pvp-ui-sync.css?v=20261125-ui-sync1'));
const host=String(file('public/pvp/pvp-host.js'));
assert.match(host,/>Import Deck<\/button>/);
const css=String(file('public/battle/runtime/pvp-ui-sync.css'));
assert.match(css,/#phasePrimaryAction\.gl-pass:not\(:disabled\)/);
assert.match(css,/grid-template-columns:160px minmax\(0,1fr\) max-content/);
const review=String(file('public/battle/shared-app/db158-card-review.js'));
assert.ok(review.includes('GL_PVP_ARTWORK?.attach?.(document)'));
assert.ok(review.includes('GL_PVP_ARTWORK?.bind?.(art,{cardId:x.id'));
console.log('PASS UI SYNC regression lock: 250 self-contained exact thumbs, universal face-up path, privacy guard, review, lobby, PASS/reposition and both pages');
