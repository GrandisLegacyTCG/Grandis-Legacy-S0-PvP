// Authority hashes deliberately renewed for approved PvP Legacy/Casting continuation; all transport/artwork hashes retained.
/** UI-only VS AI standalone follow-up gate. Does not assert a live match. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const file=x=>readFileSync(new URL('../'+x,import.meta.url));
const s=String(file('public/battle/shared-app/app-runtime.js'));
const css=String(file('public/battle/runtime/pvp-vsai-followup-20261125.css'));
const battle=String(file('public/battle/index.html'));
const lobby=String(file('public/index.html'));
const scroll=String(file('public/battle/shared-ui/pvp-mobile-card-list-scroll.js'));
const review=String(file('public/battle/shared-app/db158-card-review.js'));
const lobbyReview=String(file('public/pvp/db158-card-review.js'));
assert.match(battle,/pvp-vsai-followup-20261125\.css\?v=pvp-ui-sync2/);
assert.match(battle,/pvp-mobile-card-list-scroll\.js\?v=20261126-rc43-collection-scroll/);
assert.match(battle,/app-runtime\.js\?v=20261126-rc43-ui/);
assert.ok(lobby.includes('pvp-ui-sync.css?v=20261125-ui-sync1'));
for(const part of ['function directActionNormalWidth(stage)','function fitCenterActionCards()','function fitSwapActionCards()', 'mobile ? .89 : 1','centerChoiceStage.dataset.glActionPopup=\'1\'', 'function layoutAdaptiveHand(track,side)','function playedCardCapacity()', 'const capacity=playedCardCapacity()','const draw=(host,arr,slots=0)', 'i<slots', 'function updateMobileStatusTip()', 'closeMobileStatusTip()', 'updateMobileStatusTip();queuePvpSwapNotices(s)'])assert.ok(s.includes(part),'Missing runtime contract: '+part);
for(const part of ['.gl-center-choice-cards>.gl-center-choice-card','--gl-action-card-w', '.gl-hp-overlay', '--gl-hero-ui-unit', '.gl-mobile-status-tip.open','.hand .hand-track.gl-hand-dense','.played[data-gl-played-rows="3"]', 'var(--gl-stage-logical-w,1600px)'])assert.ok(css.includes(part),'Missing CSS contract: '+part);
for(const part of ['gl-stage-portrait','touchmove','touch-action','scrollTop','gl-pvp-mobile-touch-scroll-scale','stopImmediatePropagation'])assert.ok((scroll+css).includes(part),'Missing touch scroll contract: '+part);
for(const part of ['function syncMobileReview(frame)','GL_MOBILE_POPUP_SCROLL?.attachReview?.(d)','syncMobileReview(frame)'])assert.ok(review.includes(part),'Missing battlefield review contract: '+part);
for(const part of ['function syncMobileLobbyReview(frame)','gl-pvp-mobile-desktop','overscroll-behavior:contain','review-header{position:sticky'])assert.ok(lobbyReview.includes(part),'Missing lobby review contract: '+part);
for(const [path,sha] of Object.entries({
 'server.js':'b6ccaa65c2d8e7d53df2b6e01ad4ef5345858052c22aebf4d08fa563d027d36b',
 'public/battle/runtime/pvp-network.js':'345e3e7ca11ae678edfc1b2fcacb77ff3904458b2892219aff6ee3a1e4c9b512',
 'public/battle/runtime/adapters/pvp-adapter.js':'c0ac42811adcf9c663284d09edadc98ab24c8c6c40c184e3bd645b4964f45d72',
 'public/battle/runtime/adapters/authority-adapter.js':'859992904b9cc814e8a3ae249e60431c9eafdcd90a7c81db236b60458fabbb00',
 'public/battle/engine/shared-app/app.bundle.js':'a978738c2a9ed4aa5f91f7864e56cb3d3b1d785bb703cf75d985207ccca7ead1',
 'public/battle/runtime/pvp-artwork-loader.js':'cd8713227c4a520ecd93e0bf455ddd6eed68dffa9067247e94eeb67765891297',
 'public/battle/runtime/pvp-card-thumbnails.js':'aed60340a6d87252c3a6797354ab9f9932732a587c53320077106c84ace87f5f'
}))assert.equal(createHash('sha256').update(file(path)).digest('hex'),sha,'UI donor overwrote protected PvP core: '+path);
console.log('PASS latest standalone donor UI: adaptive popup 100/89, 6/9 played, HP, status tap, hand, scroll, lobby/battle review; approved network/engine/artwork SHA');
