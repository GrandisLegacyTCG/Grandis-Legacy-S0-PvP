/** Stage 3 upgrade of the historic donor source lock.
 * Source donor mechanisms can advance, but PvP bridge contracts cannot regress.
 * The same historic entry point is intentionally retained for existing CI.
 */
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=process.cwd(), meta=JSON.parse(readFileSync(join(root,'docs/STAGE3_DONOR_PROVENANCE.json'),'utf8'));
const digest=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
assert.equal(meta.starter_count,5);assert.equal(meta.local_artwork_count,250);
for(const [rel,sha] of Object.entries(meta.donor_immutable_files_sha256)) {
 const file=join(root,'public/battle',rel);
 assert.equal(digest(file),sha,'Approved donor source changed or overwritten: '+rel);
}
const bundle=join(root,'public/battle/engine/shared-app/app.bundle.js');
assert.ok(statSync(bundle).size>1900000);
assert.equal(digest(bundle),meta.pvp_integrated_bundle_sha256);
const stdout=execFileSync('python3',['scripts/integrate-vsai-with-pvp-contracts.py','--verify'],{cwd:root,timeout:12000,encoding:'utf8'});
assert.match(stdout,/PASS approved donor byte-identical after reverse transform/);
assert.match(stdout,/PASS reviewed PvP multiplayer bridge boundaries/);
assert.equal(meta.donor_bundle_sha256, /DONOR_SHA='([a-f0-9]{64})'/.exec(readFileSync(join(root,'scripts/integrate-vsai-with-pvp-contracts.py'),'utf8'))?.[1]);
console.log('PASS Stage 3 donor integration integrity: 6 byte-identical immutable sources, approved donor SHA, reversible reviewed PvP bridge');
