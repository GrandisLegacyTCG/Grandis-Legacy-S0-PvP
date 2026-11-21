import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';
const root=join(process.cwd(),'public');
const read=p=>readFileSync(join(root,p),'utf8');
const ctx={};ctx.window=ctx;
for(const file of ['battle/engine/shared-app/active-starters.js','pvp/s0-lobby-catalog.js','battle/runtime/season0-generated/rc41-approved-print-overrides.js'])vm.runInNewContext(read(file),ctx);
const ids=Object.keys(ctx.GL_ACTIVE_STARTER_DECKS);assert.deepEqual(ids,Object.keys(ctx.GL_S0_LOBBY_STARTERS));
assert.equal(ids.length,5);
for(const id of ids){assert.deepEqual(JSON.parse(JSON.stringify(ctx.GL_ACTIVE_STARTER_DECKS[id])),JSON.parse(JSON.stringify(ctx.GL_S0_LOBBY_STARTERS[id])));}
assert.equal(ctx.GL_ACTIVE_STARTER_SET_META.schema_version,'GL-ACTIVE-STARTERS-S0-R3.94-RULEBOOK-V3.5');
assert.ok(Object.keys(ctx.GL_RC41_R39_PRINT_OVERRIDES).length>=38);
const art=readdirSync(join(root,'battle/card-art')).filter(s=>/^S0-.*\.webp$/.test(s));assert.equal(art.length,250);
for (const name of art){const bytes=readFileSync(join(root,'battle/card-art',name));assert.ok(bytes.length>1000,name);}
assert.equal(readdirSync(root).includes('card-art'),false,'No duplicate root card-art folder');
const id='gl-s0-pvp-stage3-rc42-r394-20261122-a';assert.ok(read('index.html').includes(id));assert.ok(read('battle/index.html').includes(id));
assert.ok(read('battle/index.html').includes('rc41-approved-print-overrides.js'));
assert.ok(read('pvp/pvp-host.js').includes('https://grandislegacytcg.web.id/vs-ai/'));
assert.ok(read('battle/engine/shared-app/app.bundle.js').includes('applyExactManaPayment:function'));
assert.ok(read('battle/engine/shared-app/app.bundle.js').includes('commitExactResponsePaymentChoice'));
console.log('PASS RC41: five consistent starters, 38 official print overrides, 250 local card images, matching build id and exact mana intents.');
