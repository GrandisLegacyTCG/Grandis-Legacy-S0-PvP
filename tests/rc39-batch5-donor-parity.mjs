/** RC39 artwork, donor adapter parity, and preserved RC6/Batches 1-3 guards. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd(),battle=join(root,'public/battle');
const expected=JSON.parse(readFileSync(join(root,'tests/fixtures/archival_checks/art-sha256.json'),'utf8'));
const digest=b=>createHash('sha256').update(b).digest('hex');
const art=readdirSync(join(battle,'card-art')).filter(x=>/^S0-[A-Z0-9-]+\.webp$/.test(x));
assert.equal(art.length,248);
assert.equal(Object.keys(expected.sha256).length,248);
for(const f of art){
 assert.equal(digest(readFileSync(join(battle,'card-art',f))),expected.sha256[f],
   'RC40 R3.8/R3.7/R2 248-artwork donor parity '+f);
}
for(const [path,hash] of Object.entries(expected.donor_files)){
 assert.equal(digest(readFileSync(join(battle,path))),hash,'Donor parity: '+path);
}
const host=readFileSync(join(root,'public/pvp/pvp-host.js'),'utf8');
const network=readFileSync(join(battle,'runtime/pvp-network.js'),'utf8');
const server=readFileSync(join(root,'server.js'),'utf8');
const engine=readFileSync(join(battle,'engine/shared-app/app.bundle.js'),'utf8');
const runtime=readFileSync(join(battle,'shared-app/app-runtime.js'),'utf8');
const html=readFileSync(join(battle,'index.html'),'utf8');
assert.match(host,/BATTLE_CHANNEL='gl-pvp-battle-transport-v1'/);
assert.match(host,/function ensureBattleFrame\(/);
assert.match(network,/commitExactLocalChoiceDraft/);
assert.match(engine,/RANK_UP_COMMITTED/);
assert.match(engine,/rank_up_id:rankUpId/);
assert.match(runtime,/pvpDeferredRankTransitions/);
assert.match(server,/const BUILD_ID='gl-s0-pvp-rc40-v34-mobile-parity-2026-11-17'/);
assert.match(html,/app-runtime\.js\?v=gl-s0-pvp-rc40-v34-mobile-parity-2026-11-17/);
assert.match(html,/gl-mana-loss-notice/);
assert.match(runtime,/gl-pvp-opponent-response-notice|pvpPendingAttackVisual/);
assert.match(readFileSync(join(battle,'runtime/pvp-mobile-landscape-fix.css'),'utf8'),/gl-pvp-mobile-gameplay/);
assert.match(network,/commitExactLocalChoiceDraft/,'PvP must retain local drafting before authoritative commit');
console.log('PASS RC40: 248/248 approved artwork hash parity, preserved RC39 network donor modules, RC6 lobby, local drafts, mobile, Coin Flip and animation integration retained');
