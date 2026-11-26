/** Public GitHub release guard: no private developer notes in published source/HTTP tree. */
import assert from 'node:assert/strict';
import {existsSync,readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
const ROOT=resolve(new URL('../',import.meta.url).pathname);
const list=(dir)=>!existsSync(dir)?[]:readdirSync(dir,{withFileTypes:true}).flatMap(d=>{
 const p=join(dir,d.name);return d.isDirectory()?list(p):d.isFile()?[relative(ROOT,p).replaceAll('\\','/')]:[];
});
const docs=list(join(ROOT,'docs'));
assert.deepEqual(docs,['docs/NETWORK_RULES.md'],'Only the normative network rules may be in top-level public docs');
const readme=readFileSync(join(ROOT,'README.md'),'utf8');
assert.match(readme,/VS AI RC\d+ Standalone/,'Only donor version/provenance reference is required');
assert.doesNotMatch(readme,/Update Notes|Change History|PATCH32_AUDIT|STEP3_FINAL_RELEASE|G01[–-]G05|UI_SYNC2_Audit/i,'No internal donor update history');
const rules=readFileSync(join(ROOT,'docs/NETWORK_RULES.md'),'utf8');
for(const requirement of ['server','WebSocket','ACK','revision','idempotency','reconnect','Response','pending','privacy','Spectator','continuation']){
 assert.ok(rules.toLowerCase().includes(requirement.toLowerCase()),'Network rule missing '+requirement);
}
const served=list(join(ROOT,'public'));
const forbidden=served.filter(f=>
  f.startsWith('public/docs/') ||
  /\.(md|log|csv|py|map)$/i.test(f) ||
  /\/check-[^/]+\.cjs$|\/stage7-[^/]+\.cjs$|\/qa-[^/]+\.cjs$/i.test(f) ||
  /(?:dev[-_]?notes|handoff|audit[-_]?report|release[-_]?log|internal[-_]?qa)/i.test(f)
);
assert.deepEqual(forbidden,[],'Web-served directory must not publish developer notes / probes');
const all=list(ROOT);
const forbiddenFiles=all.filter(f=>/\.(pem|p12|pfx|key|env|log)$/i.test(f) || /(^|\/)\.env(?:\..+)?$/i.test(f));
assert.deepEqual(forbiddenFiles,[],'No credentials, raw logs or local environment files may be published');
for(const f of ['server.js','server/headless-rc32.mjs','public/index.html','public/battle/index.html',
 'public/battle/runtime/pvp-network.js','public/battle/runtime/pvp-artwork-loader.js',
 'scripts/asset-dedup-manifest.json','scripts/hydrate-duplicate-assets.mjs',
 'tests/mana.mjs','tests/network.mjs','tests/gameplay.mjs','tests/assets.mjs','tests/publication.mjs']){
 assert.ok(existsSync(join(ROOT,f)) && statSync(join(ROOT,f)).isFile(),'Protected runtime/test missing '+f);
}
assert.deepEqual(list(join(ROOT,'tests')).sort(),['assets','gameplay','mana','network','publication'].map(n=>'tests/'+n+'.mjs'),'Public test allowlist exceeded');
console.log('PASS publication hygiene: network rules retained, private notes/screenshots/logs absent; '+served.length+' public files scanned');
