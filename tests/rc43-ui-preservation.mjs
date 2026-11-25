/** RC43 visual donor adoption: protected gameplay/transport never overwritten. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
const ROOT=resolve(new URL('../',import.meta.url).pathname);
const get=x=>readFileSync(join(ROOT,x));
const str=x=>String(get(x));
const HASHES={
  'server.js':'553403d0600cccf186a6388b54d110f998861e414d72c18393a0820540a341fe',
  'public/battle/runtime/pvp-network.js':'345e3e7ca11ae678edfc1b2fcacb77ff3904458b2892219aff6ee3a1e4c9b512',
  'public/battle/runtime/adapters/pvp-adapter.js':'c0ac42811adcf9c663284d09edadc98ab24c8c6c40c184e3bd645b4964f45d72',
  'public/battle/runtime/adapters/authority-adapter.js':'859992904b9cc814e8a3ae249e60431c9eafdcd90a7c81db236b60458fabbb00',
  'public/battle/engine/shared-app/app.bundle.js':'552792fbcfd146ff3e91e8d35c5f7d26a22c1b057e43b50e6849d1ff85fcc734',
  'public/battle/runtime/pvp-artwork-loader.js':'cd8713227c4a520ecd93e0bf455ddd6eed68dffa9067247e94eeb67765891297',
  'public/battle/runtime/pvp-card-thumbnails.js':'aed60340a6d87252c3a6797354ab9f9932732a587c53320077106c84ace87f5f'
};
for(const [path,sha] of Object.entries(HASHES))assert.equal(createHash('sha256').update(get(path)).digest('hex'),sha,'Protected core regression: '+path);
const html=str('public/battle/index.html'),runtime=str('public/battle/shared-app/app-runtime.js'),css=str('public/battle/runtime/pvp-vsai-rc43-ui.css'),platform=str('public/battle/shared-ui/pvp-platform.js'),scroll=str('public/battle/shared-ui/pvp-mobile-card-list-scroll.js');
for(const path of ['shared-ui/pvp-platform.js','runtime/pvp-vsai-rc43-ui.css','shared-app/app-runtime.js','shared-ui/pvp-mobile-card-list-scroll.js'])assert.ok(html.includes(path),'RC43 UI script/style not included: '+path);
assert.ok(html.indexOf('shared-ui/pvp-platform.js')<html.indexOf('id="gl-responsive-stage-js"'),'Device platform detection too late');
assert.ok(html.includes('const touchDevice=()=>window.GL_PLATFORM?.isMobile?.()===true;'),'Touch-hardware desktop would be treated as a phone');
for(const key of ['glChoiceHandArtMask','gl-hand-mask-cards','handSearchArtwork','function fitCollectionPopup()','function resetCollectionPopup()','function pvpMouseHoverEvent(e)','--gl-hand-action-scale',"incoming_ability_damage","function isHandsetViewport(){","window.GL_PLATFORM?.isMobile?.()===true"]){assert.ok(runtime.includes(key),'Missing RC43 visual contract '+key);}
for(const key of ['gl-choice-to-hand svg.gl-choice-hand-window','gl-collection-popup:not(.gl-choice-to-hand)','--gl-hand-action-unit','gl-result-close','gl-result-back'])assert.ok(css.includes(key),'Missing RC43 CSS '+key);
assert.ok(scroll.includes('.gl-vsai-choice-overlay.gl-collection-popup'),'RC43 collection rotated scroll missing');
assert.ok(platform.includes('GL_PLATFORM')&&platform.includes('URLSearchParams'),'platform profile override missing');
const donorReview=['app.css','s0-enhancements-v1.32.2.css','s0-shared-header-review.css','s0-part7-revision-v1.36.css','s0-part7-revision-v1.38.css','s0-part7-revision-v1.39.css','s0-review-v1.41.css','s0-review-v1.42.css','s0-review-v1.43.css','s0-review-v1.44.css','s0-ui-v1.49.css','s0-hotfix-v1.49.1.css','s0-layout-v1.50.css','s0-modal-parity-v1.52.css','s0-review-v1.54.css','s0-review-v1.56.css','s0-review-v1.57.css','s0-launch-v1.58.css','s0-rulebook-v2.9-review-v1.58.css','s0-mobile-header-v1.63.css','s0-filter-layout-v1.64.css','s0-validation-tooltip-v1.64.css','s0-filter-parity-v1.64.css','s0-filter-responsive-fix-v1.65.css','s0-card-image-loader-v1.68.css','s0-ui-polish-v1.66.css','s0-toast-feedback.css'];
for(const script of ['public/pvp/db158-card-review.js','public/battle/shared-app/db158-card-review.js']){
 const src=str(script),value=src.match(/var files=(\[[^;]+\]);/);
 assert.ok(value,script+' no review styles');
 assert.deepEqual(JSON.parse(value[1].replaceAll("'",'"')),donorReview,'RC43 native Review CSS order drift '+script);
 for(const cssName of donorReview)assert.ok(existsSync(join(ROOT,'public/battle/assets/review-db158/css',cssName)),'Missing Review CSS '+cssName);
}
const site=process.env.PVP_WEBSITE_ROOT;
if(site){for(const file of ['battle/index.html','battle/shared-app/app-runtime.js','battle/runtime/pvp-vsai-rc43-ui.css','battle/shared-ui/pvp-platform.js','battle/shared-ui/pvp-mobile-card-list-scroll.js','pvp/db158-card-review.js','battle/shared-app/db158-card-review.js',...donorReview.map(n=>'battle/assets/review-db158/css/'+n)])assert.deepEqual(get('public/'+file),readFileSync(join(resolve(site),file)),'Standalone/Website UI mismatch '+file);}
console.log('PASS RC43 UI preservation: 7 protected engine/network/artwork hashes; platform, Hand SVG, collection, damage disclosure; 27 native donor Review CSS in both PvP surfaces; paired source byte parity');
