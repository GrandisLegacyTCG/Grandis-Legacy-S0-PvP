/** STEP3: standalone/website contract; this does not modify either package. */
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {join, resolve, relative} from 'node:path';
import {createHash} from 'node:crypto';
const standalone=resolve(new URL('../public/',import.meta.url).pathname);
const expected='gl-s0-pvp-rc44-r40-r40-20261127';
const site=process.env.PVP_WEBSITE_ROOT ? resolve(process.env.PVP_WEBSITE_ROOT) : null;
const b=readFileSync(join(standalone,'build-meta.js'),'utf8');
assert.ok(b.includes(expected),'Standalone build S3 missing');
const sb=readFileSync(join(standalone,'battle/index.html'),'utf8');
const lb=readFileSync(join(standalone,'index.html'),'utf8');
assert.ok(sb.includes(expected),'Standalone battlefield versioned links must match S3');
assert.ok(lb.includes(expected),'Standalone lobby versioned links must match S3');
const allFiles=(dir,base=dir)=>readdirSync(dir,{withFileTypes:true}).flatMap(item=>{
  const p=join(dir,item.name);return item.isDirectory()?allFiles(p,base):item.isFile()?[relative(base,p).replaceAll('\\','/')]:[];
});
if(site){
 assert.ok(existsSync(site),'Missing Website pvp root');
 assert.ok(readFileSync(join(site,'build-meta.js'),'utf8').includes(expected),'Website build mismatch');
 const critical=['index.html','build-meta.js','battle/index.html','pvp/pvp-host.js',
  'battle/runtime/pvp-network.js','battle/runtime/pvp-mana-draft.js','battle/runtime/pvp-artwork-loader.js',
  'battle/runtime/pvp-card-thumbnails.js','battle/runtime/pvp-mobile-landscape-fix.css',
  'battle/runtime/pvp-mobile-all5.css','battle/engine/shared-app/app.bundle.js',
  'battle/engine/js/static-data.js','battle/shared-app/app-runtime.js',
  'battle/shared-ui/battlefield-ui.css','battle/shared-ui/pvp-mobile-preview-hold.js',
  'assets/ui/back-main.webp','assets/ui/back-legacy.webp','assets/ui/back-shard.webp',
  'lobby/pvp-ui-sync.css','battle/runtime/pvp-ui-sync.css','battle/shared-app/db158-card-review.js'];
 for(const path of critical){
  assert.ok(existsSync(join(site,path)),'Missing Website '+path);
  assert.deepEqual(readFileSync(join(site,path)),readFileSync(join(standalone,path)),'Stand-alone and Website component drift: '+path);
 }
 const cf=readFileSync(join(site,'config.js'),'utf8');
 assert.match(cf,/wsBase/,'Website must have explicit WSS base');
 assert.match(cf,/wsPath/,'Website must have WSS path');
 const files=allFiles(site).filter(x=>x!=='docs/WEBSITE_FILES_MANIFEST.json');
 const manifest=JSON.parse(readFileSync(join(site,'docs/WEBSITE_FILES_MANIFEST.json'),'utf8'));
 assert.equal(manifest.package_root,'pvp/');
 assert.equal(manifest.file_count_excluding_manifest,files.length,'Website manifest stale count');
 assert.equal(Object.keys(manifest.sha256||{}).length,files.length);
 for(const f of files){
  const hash=createHash('sha256').update(readFileSync(join(site,f))).digest('hex');
  assert.equal(manifest.sha256['pvp/'+f],hash,'Website sha256 manifest stale: '+f);
  assert.ok(!f.startsWith('server/')&&!/^server\.js$/.test(f),'Website package includes backend');
  assert.ok(!f.startsWith('card-art/'),'Website includes full card art, not allowed');
 }
 for(const f of ['index.html','battle/index.html']){
  const html=readFileSync(join(site,f),'utf8');
  assert.match(html,/\/assets\/site\/web-s0\/favicon\.png/);
  assert.match(html,/\/assets\/js\/gl-site-analytics\.js/);
 }
 const dirs=allFiles(site).filter(x=>/battle\/assets\/thumbnails\/.+\.webp$/.test(x));
 assert.equal(dirs.length,250,'Website thumbnails not 250');
 console.log('PASS STEP3 paired release: build IDs S3, critical engine and UI byte-identical, 250 thumbnails, '+files.length+' Website manifest SHA-256 entries, root only pvp/');
}else{
 console.log('PASS STEP3 standalone build S3; set PVP_WEBSITE_ROOT for paired Website manifest and sha integrity');
}
