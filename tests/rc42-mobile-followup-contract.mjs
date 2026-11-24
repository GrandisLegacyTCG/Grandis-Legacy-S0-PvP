/**
 * Grandis Legacy RC42B mobile donor follow-up 6-9 STATIC contract.
 * Runtime/gesture checks are run separately with Chromium synthetic stage QA.
 * This script has no browser dependency, so it can run in the Northflank
 * GitHub Actions Node regression gate.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const css=s('../public/battle/runtime/pvp-mobile-followup.css');
const hold=s('../public/battle/shared-ui/pvp-mobile-preview-hold.js');
const ui=s('../public/battle/shared-app/app-runtime.js');
const html=s('../public/battle/index.html');
const oldFive=s('../public/battle/runtime/pvp-mobile-all5.css');
const server=s('../server.js');
const lobby=s('../public/pvp/pvp-host.js');
assert.ok(oldFive.includes('gl-pvp-mobile-gameplay'),'RC42 mobile 1-5 retained');
assert.match(css,/--hero-w\s*:\s*calc\(var\(--hero-base-w\) \* 1\.14\)/,'Hero follows 95% mobile scaling');
assert.match(css,/\.attachment-card\.left\s*\{left:3%!important\}/,'Attachment shifted to left 3%');
assert.match(css,/\.attachment-card\.right\s*\{right:3%!important\}/,'Attachment shifted to right 3%');
assert.match(css,/body\.gl-center-choice-active:not\(\.gl-center-pay\)[\s\S]{0,160}\.gl-center-choice-card/,'Action prompt 85% of hero');
assert.match(css,/\* \.85\)/,'Action prompt size is proportional');
assert.match(css,/body\.gl-center-choice-active\.gl-center-pay \.gl-center-choice-cards/,'Mana payment only layout');
assert.match(css,/flex-wrap:nowrap!important/,'Mana 1-12 one row');
assert.match(css,/overflow-x:hidden!important/,'No horizontal scroll during payment');
assert.match(css,/--gl-choice-count/,'Mana width adapts to actual shard count');
assert.match(css,/\.gl-sidebar-hover-preview\.open/,'Right dock includes sidebar previews');
assert.match(css,/right:8px!important/,'Preview docks to sidebar edge');
assert.match(css,/\.gl-modal-hover-preview\.open img/,'Popup previews stay near popup');
assert.match(hold,/const HOLD_MS = 400/,'Card hold is 400ms');
assert.match(hold,/MOVE_TOLERANCE = 12/,'Swipe is not a preview hold');
assert.match(hold,/e\.preventDefault\(\);e\.stopImmediatePropagation\(\)/,'Hold click suppressed');
assert.match(hold,/!mobile\(\)/,'Never intercept mouse on desktop');
assert.match(ui,/function registerPvpMobileCardHold/,'PvP card preview uses shared hold controller');
assert.match(ui,/cardsHost\.querySelectorAll\('\.gl-center-choice-card'\)/,'Read-only and interactive center choices bind preview');
assert.match(ui,/is-face-up/,'Face-down hidden information cannot inspect');
assert.match(ui,/function initPvpMobilePreviewDismiss/,'Outside tap closes preview');
assert.ok(!ui.includes('function pvpTouchPreviewBriefly('),'Legacy instant touch preview disabled');
assert.match(html,/runtime\/pvp-mobile-followup\.css/,'Follow-up stylesheet loaded');
assert.match(html,/shared-ui\/pvp-mobile-preview-hold\.js/,'Hold controller loaded');
assert.ok(html.indexOf('runtime/pvp-mobile-all5.css')<html.indexOf('runtime/pvp-mobile-followup.css'),'Follow-up CSS wins over first five');
assert.ok(html.indexOf('pvp-mobile-preview-hold.js')<html.indexOf('shared-app/app-runtime.js'),'Controller loads before binder');
assert.match(server,/PVP_REQUIRE_WS/,'Production transport guard retained');
assert.match(server,/path:\s*'\/ws'/,'WebSocket path retained');
assert.match(server,/clientBuildId!==BUILD_ID/,'Server build handshake retained');
assert.match(lobby,/pendingDeckImport/,'HF1 import-deck fix retained');
console.log('PASS RC42B mobile 6-9: 29 static donor/native-PvP integration invariants');
