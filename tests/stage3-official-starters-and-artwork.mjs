/** Final official five-starter synchronization and art protection contract. */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {season0StarterCatalog} from '../server/s0-pregame-catalog.mjs';
import {Season0HeadlessAuthority} from '../server/headless-rc32.mjs';
const root=resolve('public'),battle=join(root,'battle'),stDir=join(battle,'engine/starter_deck_examples');
const evalDecks=path=>{const w={};w.window=w;vm.runInNewContext(readFileSync(path,'utf8'),w,{timeout:15000});return w};
const active=evalDecks(join(battle,'engine/shared-app/active-starters.js'));
const lobby=evalDecks(join(root,'pvp/s0-lobby-catalog.js'));
const ids=Object.keys(active.GL_ACTIVE_STARTER_DECKS).sort();
assert.equal(ids.length,5);
assert.deepEqual(Object.keys(lobby.GL_S0_LOBBY_STARTERS).sort(),ids);
assert.deepEqual(Object.keys(season0StarterCatalog).sort(),ids);
assert.equal(active.GL_ACTIVE_STARTER_SET_META.schema_version,'GL-ACTIVE-STARTERS-S0-R3.94-RULEBOOK-V3.5');
const sourceExports=['1_Blue_Red_Deck.json','2_Yellow_Blue_Deck.json','3_Red_White_Deck.json','4_Green_Yellow_Deck.json','5_White_Green_Deck.json'];
let checks=0;
for(let i=0;i<5;i++){
 const id=ids.find(x=>x.startsWith('s0_starter_0'+(i+1)+'_'));assert.ok(id);
 const entry=active.GL_ACTIVE_STARTER_DECKS[id],deck=JSON.parse(JSON.stringify(entry.deck));
 const expected=JSON.parse(JSON.stringify(lobby.GL_S0_LOBBY_STARTERS[id].deck));
 assert.deepEqual(deck,expected,id+' lobby diverged');
 assert.deepEqual(deck,JSON.parse(JSON.stringify(season0StarterCatalog[id].deck)),id+' server diverged');
 const exportPath=join(stDir,'official_exports',sourceExports[i]);
 const raw=readFileSync(exportPath);const official=JSON.parse(raw);
 assert.equal(createHash('sha256').update(raw).digest('hex'),deck.source_export_sha256,id+' source hash');
 const sortMain=arr=>arr.map(x=>`${x.card_id}:${x.quantity}`).sort();
 assert.deepEqual(sortMain(deck.main_deck),sortMain(official.deck.main_deck),id+' Main composition changed');
 assert.equal(deck.main_deck.reduce((n,x)=>n+x.quantity,0),50,id+' Main != 50');
 assert.equal(deck.mana_deck.reduce((n,x)=>n+x.quantity,0),12,id+' Mana != 12');
 assert.equal(deck.legacy_deck_expanded.length,12,id+' Legacy != 12');
 assert.equal(deck.legacy_deck_package_slots.length,3,id+' progression packages != 3');
 assert.equal(deck.default_formation.LEFT!=null,true);assert.equal(deck.default_formation.CENTER!=null,true);assert.equal(deck.default_formation.RIGHT!=null,true);
 const a=new Season0HeadlessAuthority(battle);
 a.start({player1DeckKey:id,player2DeckKey:id});a.completeOpening(i%2===0?1:2,'HEADS');
 const state=a._canonicalForServerOnly().appState;
 assert.ok(['PLAYER','AI'].includes(state.turn)&&!state.pending&&state.phase==='Deploy',id+' did not start');
 assert.equal(a.starterIds.length,5);
 checks++;
 console.log(`PASS official starter ${i+1}: exported source sha, 50 Main, 12 Mana, 12 Legacy, live server start`);
}
const a=new Season0HeadlessAuthority(battle);
const newCards={'S0-EVT-013':'Cheers!','S0-ITM-021':'Fire Flask'};
for(const [id,label] of Object.entries(newCards)){
 const c=a.getCardForQA(id);assert.equal(c.name,label,id+' donor engine did not load card');
 assert.ok(statSync(join(battle,'card-art',id+'.webp')).size>1000);
 checks++;
}
const artwork=readdirSync(join(battle,'card-art')).filter(n=>/^S0-.*\.webp$/.test(n));
assert.equal(artwork.length,250);
const tokens=readFileSync(join(battle,'runtime/pvp-card-thumbnails.js'),'utf8');
for(const [id] of Object.entries(newCards))assert.ok(tokens.includes('"'+id+'"'),id+' has no thumbnail');
assert.ok(tokens.includes('S0-ARC-001'));
assert.ok(readFileSync(join(battle,'index.html'),'utf8').indexOf('rc42-main-deck-r394-overlay.js')<readFileSync(join(battle,'index.html'),'utf8').indexOf('engine/shared-app/app.bundle.js'));
checks++;
console.log(`PASS Stage 3 official starters & artwork: ${checks} strict checks, 5 playable starters, 2 new cards, 250 local artwork`);
