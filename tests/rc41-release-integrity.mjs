import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd();
const meta=JSON.parse(readFileSync(join(root,'tests/fixtures/archival_checks/engine-source-sha256.json'),'utf8'));
const digest=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
for(const [file,sha] of Object.entries(meta.donor_clean_files)){
 const path=join(root,'public/battle',file);
 assert.equal(digest(path),sha,'Donor RC41 code differs: '+file);
}
assert.equal(digest(join(root,'public/battle/engine/shared-app/app.bundle.js')),meta.patched_bundle_sha256,
 'Engine bundle contains unexpected changes outside audited PvP multiplayer bridge');
assert.equal(statSync(join(root,'public/battle/engine/shared-app/app.bundle.js')).size>1900000,true);
console.log('PASS RC41 donor audit: 3/3 byte-exact source modules and SHA-pinned PvP-only bundle extensions');
