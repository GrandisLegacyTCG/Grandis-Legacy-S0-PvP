import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {isCompletedOpponentManaContinuation} from '../server/commit-semantics.mjs';

const source = readFileSync(resolve('server/headless-rc32.mjs'), 'utf8');
const anchor = '  /** A verified seat may concede without turn/response ownership. */';
assert(source.includes(anchor), 'Fixture injection boundary moved');
const injected = source
  .replace("import {PvpCombatPresentationLedger} from './combat-presentation.mjs';", `import {PvpCombatPresentationLedger} from '${pathToFileURL(resolve('server/combat-presentation.mjs')).href}';`)
  .replace("import {PvpDiscardPresentationLedger} from './discard-presentation.mjs';", `import {PvpDiscardPresentationLedger} from '${pathToFileURL(resolve('server/discard-presentation.mjs')).href}';`)
  .replace("import {isCompletedOpponentManaContinuation} from './commit-semantics.mjs';", `import {isCompletedOpponentManaContinuation} from '${pathToFileURL(resolve('server/commit-semantics.mjs')).href}';`)
  .replace(anchor, `  injectStep1Fixture(s){this.#canonical=structuredClone(s);this.#bridgeSeat=null;this.#bridgeRevision=-1;}\n${anchor}`);
const {Season0HeadlessAuthority:Authority} = await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(injected));
const root=join(process.cwd(),'public/battle');
const startingKeys={1:'s0_starter_03_red_white',2:'s0_starter_01_blue_red'};

for (const actorSeat of [1,2]) {
  for (const mode of ['REMOVE_ONLY','REMOVE_AND_GAIN_OWN']) {
    const authority = new Authority(root);
    authority.start({player1DeckKey:startingKeys[1],player2DeckKey:startingKeys[2]});
    authority.completeOpening(1,'HEADS');
    const original = authority._canonicalForServerOnly(), s = original.appState;
    const side=actorSeat===1?'PLAYER':'AI',other=side==='PLAYER'?'AI':'PLAYER';
    const targetPoolKey=other==='PLAYER'?'playerManaPoolCards':'aiManaPoolCards';
    const ownPoolKey=side==='PLAYER'?'playerManaPoolCards':'aiManaPoolCards';
    const originalPool=s[targetPoolKey].map(x=>x.uid), ownCount=s[ownPoolKey].length;
    assert(originalPool.length>=2,'Starting pool requires two Shards');
    s.turn=side;s.phase='Battle';s.gameOver=false;s.responseWindow=null;
    s.pending={type:'opponent_mana_selection',side,decision_side:side,target_side:other,
      mode,reason:'Step1 Attack Mana '+mode,required_count:2,
      candidates:s[targetPoolKey].map(x=>({uid:x.uid})),selected_indices:[],
      continuation:{action:{card_id:'S0-ARC-001',source_side:side,source_lane:'CENTER',target_side:other,target_lane:'CENTER'},
        post:{},result:{mana_interactions:[],connected:true,damage:20},options:{}}};
    authority.injectStep1Fixture(original);
    const rev=authority.revision;
    const result=authority.applyIntent(actorSeat,'commitExactOpponentManaSelectionIndices',[[0,1]]);
    assert.equal(result.ok,true,`Action should COMMIT (not reject) after Attack; seat ${actorSeat}`);
    assert.equal(authority.revision,rev+1);
    const after=authority._canonicalForServerOnly().appState;
    assert.equal(after.pending,null,'No pending continuation remains');
    assert.equal(after[targetPoolKey].length,originalPool.length-2,'Exactly two Shards removed');
    assert(!after[targetPoolKey].some(c=>originalPool.slice(0,2).includes(c.uid)),'Selected physical Shards removed');
    if(mode==='REMOVE_AND_GAIN_OWN')assert.equal(after[ownPoolKey].length,ownCount+2,'Mana steal adds own Shards');
    else assert.equal(after[ownPoolKey].length,ownCount,'Mana burn does not gain own Shards');
    assert.throws(()=>authority.applyIntent(actorSeat,'commitExactOpponentManaSelectionIndices',[[0,1]]),
      /decision|turn|selection|pending/i,'Replay of concluded decision must reject');
    console.log(`PASS Attack continuation: ${mode} seat ${actorSeat}, revision ${rev} -> ${authority.revision}`);
  }
}
// This discriminator is intentionally strict. An illegal action or a return false
// without the expected state change MUST NOT be turned into a success.
const message='Runtime action was not legal or no pending choice accepted: commitOpponentManaSelection';
const p={type:'opponent_mana_selection',decision_side:'PLAYER',target_side:'AI',required_count:1,
  candidates:[{uid:'shard-1'},{uid:'shard-2'}],selected_indices:[0],continuation:{action:{card_id:'S0-ARC-001'}}};
const before={pending:p,aiManaPoolCards:[{uid:'shard-1'},{uid:'shard-2'}]};
const successful={pending:null,aiManaPoolCards:[{uid:'shard-2'}]};
assert.equal(isCompletedOpponentManaContinuation({pending:p,before,after:successful,error:message}),true);
for (const fail of [
  {pending:p,before,after:before,error:message},
  {pending:p,before,after:{pending:null,aiManaPoolCards:[{uid:'shard-1'}]},error:message},
  {pending:{...p,continuation:null},before,after:successful,error:message},
  {pending:p,before,after:successful,error:'A different action failed.'},
  {pending:{...p,selected_indices:[]},before,after:successful,error:message},
  {pending:p,before,after:{pending:p,aiManaPoolCards:[{uid:'shard-2'}]},error:message},
]) assert.equal(isCompletedOpponentManaContinuation(fail),false,'Invalid or incomplete effect must not be accepted');
console.log('PASS donor terminal-false classification rejects partial/invalid effects');
