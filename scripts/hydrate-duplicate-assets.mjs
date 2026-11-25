// Grandis Legacy PvP standalone asset hydration.
// Restores byte-identical binary URL paths using local hardlinks (copy fallback).
// Gameplay engine, network packets, server authority and UI URLs are unchanged.
import { readFile, mkdir, link, copyFile, stat, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC=path.resolve(BASE,'public');
const MANIFEST=path.resolve(BASE,'scripts','asset-dedup-manifest.json');
const VERIFY_ONLY=process.argv.includes('--verify');
const allowedExtensions=new Set(['.png','.webp','.mp3','.wav','.woff2','.ico','.jpg','.jpeg']);
function safePath(rel){
  if(typeof rel!=='string'||!rel||rel.includes('\\')||rel.includes('\0')||rel.includes('//')||rel.startsWith('/'))
    throw new Error('Unsafe asset path');
  if(path.posix.normalize(rel)!==rel||rel.split('/').some(x=>!x||x==='.'||x==='..'))
    throw new Error('Noncanonical asset path '+rel);
  const absolute=path.resolve(PUBLIC,rel);
  if(!absolute.startsWith(PUBLIC+path.sep))throw new Error('Asset escapes public root');
  if(!allowedExtensions.has(path.extname(absolute).toLowerCase()))throw new Error('Non-binary alias: '+rel);
  return absolute;
}
async function digest(pathname){return createHash('sha256').update(await readFile(pathname)).digest('hex')}
const manifest=JSON.parse(await readFile(MANIFEST,'utf8'));
if(manifest.schema!==1||!Array.isArray(manifest.groups))throw new Error('Unsupported dedup manifest schema');
let groups=0,aliases=0,linked=0,copied=0,already=0;
const seen=new Set();
for(const group of manifest.groups){
  const from=safePath(group.canonical);
  const src=await stat(from);
  if(!src.isFile()||src.size!==group.bytes||await digest(from)!==group.sha256)
    throw new Error('Canonical asset missing or corrupted: '+group.canonical);
  if(seen.has(group.canonical))throw new Error('Duplicate canonical group');
  seen.add(group.canonical);
  groups++;
  for(const alias of group.aliases){
    const dest=safePath(alias);
    if(path.extname(alias).toLowerCase()!==path.extname(group.canonical).toLowerCase())
      throw new Error('Alias MIME mismatch: '+alias);
    if(seen.has(alias))throw new Error('Duplicate alias path: '+alias);
    seen.add(alias);
    aliases++;
    let existing=null;
    try{existing=await stat(dest)}catch(error){if(error?.code!=='ENOENT')throw error;}
    if(existing){
      if(!existing.isFile()||existing.size!==src.size||await digest(dest)!==group.sha256)
        throw new Error('Unexpected different asset already exists at '+alias);
      already++;continue;
    }
    if(VERIFY_ONLY)throw new Error('Alias missing: '+alias+' (run npm run prepare:assets)');
    await mkdir(path.dirname(dest),{recursive:true});
    try{await link(from,dest);linked++}
    catch(error){
      if(!['EXDEV','EPERM','EACCES','ENOTSUP','EOPNOTSUPP','ENOSYS','EMLINK'].includes(error?.code))throw error;
      // On filesystems without hardlinks, preserve standalone correctness.
      await copyFile(from,dest);copied++;
    }
    if(await digest(dest)!==group.sha256){await rm(dest);throw new Error('Hydrated bytes do not match: '+alias)}
  }
}
if(aliases!==manifest.replacedAssetFiles)throw new Error('Manifest alias count mismatch');
console.log(JSON.stringify({ok:true,mode:VERIFY_ONLY?'verify':'hydrate',groups,aliases,linked,copied,already,expectedRawMiBSaved:Math.round(manifest.savedRawBytes/1048576*100)/100}));
