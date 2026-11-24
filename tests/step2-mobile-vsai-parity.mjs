/** Season 0 PvP STEP2 : approved donor mobile UI, unchanged authoritative network. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const me=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(me,'..');
const website=process.env.PVP_WEBSITE_ROOT||'';
// Approved STEP 1 release locks; a gameplay/network change requires deliberate
// re-review and an updated integrity gate, not a silent UI donor copy.
const locks={
  'server.js':'553403d0600cccf186a6388b54d110f998861e414d72c18393a0820540a341fe',
  'server/headless-rc32.mjs':'ee418a6e12458b83e08fd3c29040fc58afb0021b9398f8b4ea2314fd663b137d',
  'server/commit-semantics.mjs':'b0b81723ea1549a736a6d73577001a8c16777dd5e00ef3d2524593e860c7c8c6',
  'public/battle/runtime/pvp-network.js':'345e3e7ca11ae678edfc1b2fcacb77ff3904458b2892219aff6ee3a1e4c9b512',
  'public/battle/runtime/adapters/pvp-adapter.js':'c0ac42811adcf9c663284d09edadc98ab24c8c6c40c184e3bd645b4964f45d72',
  'public/battle/engine/js/static-data.js':'be601cba58794a93eeb2a50522a43f19df8935e38e47651f9fb123c63cd84d93'
};
const approvedBacks={
  'back-main.webp':'09b116c862d7e4214ceee0e9df478bca825be673cc38a8f763d0217c36f97d9f',
  'back-legacy.webp':'1e1d7bda105c566426a75b8cd6d8e5c33025ff88486ca33ca7289ec47010ab86',
  'back-shard.webp':'817b05bd2642020bebd0b7365fa44e46fffc05ad2e0616dc3cec53f1bc8efbe3'
};
const src=file=>readFileSync(path.join(root,file),'utf8');
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const html=src('public/battle/index.html');
const ui=src('public/battle/shared-app/app-runtime.js');
const css=src('public/battle/runtime/pvp-mobile-vsai-batch2-parity.css');
assert.match(html,/const scale=Math\.min\(stageW\/REF_W,stageH\/REF_H\)/,'uniform VS AI scaling');
assert.doesNotMatch(html,/scale\(\$\{scaleX\},\$\{scaleY\}\)/,'no independent X/Y scale');
assert.match(html,/--gl-stage-logical-w/,'dynamic expanded logical width');
assert.match(html,/--gl-stage-logical-h/,'dynamic expanded logical height');
assert.match(html,/--gl-pvp-mobile-touch-scroll-scale/,'portrait scroll uses current uniform scale');
assert.match(css,/Phase Bar|RC42 Mobile Batch 2/i,'donor batch2 source');
for(const term of ['.attachment-card.left>.attachment-turn','.attachment-card.right>.attachment-turn','--gl-field-preview-x','gl-center-discard','data-gl-action-popup','gl-choice-count']){
 assert.ok(css.includes(term),'missing approved Batch 2 selector '+term);
}
assert.match(ui,/function mobilePreviewIsCollectionChoice/,'context collection choice');
assert.match(ui,/function mobilePreviewGroupBounds/,'context visible group');
assert.match(ui,/function placeMobileBattlefieldPreview/,'context mobile hero/mana/hand');
assert.match(ui,/function placeMobilePopupPreview/,'context modal choice');
assert.match(ui,/centerChoiceStage\.dataset\.glActionPopup/,'return EXP action popup sizing');
assert.match(html,/runtime\/pvp-mobile-vsai-batch2-parity\.css/,'new CSS loaded');
assert.ok(html.indexOf('pvp-mobile-followup.css')<html.indexOf('pvp-mobile-vsai-batch2-parity.css'),'donor styles loaded last');
for(const [file,want] of Object.entries(locks)){
 assert.equal(sha(path.join(root,file)),want,'STEP 1 network/gameplay lock changed without approval: '+file);
}
if(website){
 for(const rel of ['battle/index.html','battle/shared-app/app-runtime.js','battle/runtime/pvp-mobile-vsai-batch2-parity.css','battle/engine/shared-app/app.bundle.js']){
  assert.equal(sha(path.join(root,'public',rel)),sha(path.join(website,rel)),'standalone/website UI mismatch: '+rel);
 }
}
for(const [name,want] of Object.entries(approvedBacks)){
 for(const base of [path.join(root,'public/assets/ui'),path.join(root,'public/battle/assets/ui'),...(website?[path.join(website,'assets/ui')]:[])]){
  assert.equal(sha(path.join(base,name)),want,'outdated back-of-card '+name+' in '+base);
 }
}
const engine=src('public/battle/engine/shared-app/app.bundle.js');
for(const func of ['queueImmediateShardGainPresentation','queueOpeningManaDrawEvents','queueReservedManaDraw','renderOpponentManaSelection','queueDirectOpponentShardReturnPresentation']){
 const i=engine.indexOf('  function '+func+'(');assert(i>=0,func);
 const end=engine.indexOf('\n  function ',i+12);const section=engine.slice(i,end<0?engine.length:end);
 assert.doesNotMatch(section,/back-legacy\.webp/,'Mana shard must not use Legacy back in '+func);
 assert.match(section,/back-shard\.webp/,'Shard back missing from '+func);
}
assert.match(src('public/battle/shared-ui/pvp-mobile-preview-hold.js'),/HOLD_MS = 400/,'tap-vs-hold action parity');
console.log('PASS STEP2: donor batch2 visual contracts, uniform mobile scaling, correct three card backs, and byte-identical Step1 network/authority in two frontend variants');
