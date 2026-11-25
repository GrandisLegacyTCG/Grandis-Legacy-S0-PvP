/** Public asset hygiene: protect active Mana artwork and avoid unused binary restores. */
import assert from 'node:assert/strict';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const BASE=resolve(new URL('../',import.meta.url).pathname);
const PUBLIC=join(BASE,'public');
const host=readFileSync(join(PUBLIC,'pvp/pvp-host.js'),'utf8');
const battle=readFileSync(join(PUBLIC,'battle/shared-app/app-runtime.js'),'utf8');
assert.doesNotMatch(host,/assets\/shards\//,'Legacy class-shard images must not be preloaded or rendered by Lobby');
assert.equal(existsSync(join(PUBLIC,'assets/shards')),false,'Unused shard folder must not reappear');
const shared=join(PUBLIC,'assets/site/web-s0');
assert.deepEqual(readdirSync(shared).sort(),['favicon.png','logo-transparent.webp'],
  'Standalone Homepage-only assets must not silently enter PvP');
for(let i=1;i<=6;i++){
  const id='S0-MAN-'+String(i).padStart(3,'0');
  assert.ok(battle.includes(id),'Missing active Mana face mapping '+id);
  assert.ok(existsSync(join(PUBLIC,'battle/card-art',id+'.webp')),'Missing original '+id);
  assert.ok(existsSync(join(PUBLIC,'battle/assets/thumbnails',id+'.webp')),'Missing first-paint thumbnail '+id);
}
const manifest=JSON.parse(readFileSync(join(BASE,'scripts/asset-dedup-manifest.json'),'utf8'));
for(const g of manifest.groups){for(const alias of g.aliases){
  assert.ok(!alias.startsWith('assets/shards/'),'No shard aliases');
  assert.ok(!alias.startsWith('assets/site/web-s0/') || ['assets/site/web-s0/favicon.png','assets/site/web-s0/logo-transparent.webp'].includes(alias),
    'Obsolete site alias '+alias);
  assert.ok(!['assets/lobby/swap.png','battle/assets/lobby/swap.png'].includes(alias),'Obsolete swap aliases');
}}
for(const page of ['index.html','battle/index.html']){
  const html=readFileSync(join(PUBLIC,page),'utf8');
  assert.match(html,/\/assets\/site\/web-s0\/favicon\.png/,'Favicon missing '+page);
}
const lb=readFileSync(join(PUBLIC,'index.html'),'utf8');
assert.match(lb,/pvp-host\.js\?[^"']*asset-clean=20261126-01/,'Lobby script cache key must change when asset URLs disappear');
const site=process.env.PVP_WEBSITE_ROOT;
if(site){
  const web=resolve(site);
  assert.equal(existsSync(join(web,'assets/shards')),false,'Website should not ship legacy shard faces');
  assert.equal(readFileSync(join(web,'pvp/pvp-host.js'),'utf8'),host,'Website and Standalone Lobby scripts must match');
  assert.match(readFileSync(join(web,'index.html'),'utf8'),/asset-clean=20261126-01/);
  for(let i=1;i<=6;i++)assert.ok(existsSync(join(web,'battle/assets/thumbnails','S0-MAN-'+String(i).padStart(3,'0')+'.webp')));
}
console.log('PASS active asset hygiene: old shard preloads removed, 6 Mana full-art + thumbs intact, standalone site trims, paired PvP source compatible');
