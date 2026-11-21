// Guardrail: a donor false result is NOT globally reinterpreted as success.
// The PvP adapter may normalize exactly one verified terminal Attack Mana
// continuation; rejected, stale, partial, and other actions stay rejected.
import assert from 'node:assert/strict';
import {normalizePvpEngineOutcome} from '../server/headless-rc32.mjs';
const old = ()=>({pending:{type:'opponent_mana_selection',decision_side:'PLAYER',side:'PLAYER',target_side:'AI',
  required_count:1,candidates:[{uid:'A'},{uid:'B'}],selected_indices:[0],continuation:{action:{}}},
  aiManaPoolCards:[{uid:'A'},{uid:'B'}],aiManaDeck:[{uid:'C'}]});
const accepted = ()=>({pending:null,aiManaPoolCards:[{uid:'B'}],aiManaDeck:[{uid:'C'},{uid:'A'}]});
const genericError={ok:false,error:'Runtime action was not legal or no pending choice accepted: commitOpponentManaSelection'};
const run=(before,after,err=genericError,name='commitOpponentManaSelection')=>
  normalizePvpEngineOutcome({bridge:{getCanonicalSnapshot:()=>({appState:before.resultCalled?after:before}),
    applyServerIntent:()=>{before.resultCalled=true;return err;}},readPending:()=>old().pending,name,args:[]});
let n=0;
assert.throws(()=>run(old(),old()),/exact authoritative Mana completion/);n++;
assert.throws(()=>run(old(),{...accepted(),aiManaDeck:[{uid:'C'}]}),/exact authoritative Mana completion/);n++;
assert.throws(()=>run(old(),{...accepted(),aiManaPoolCards:[{uid:'A'}]}),/exact authoritative Mana completion/);n++;
assert.throws(()=>run(old(),accepted(),{ok:false,error:'Invalid legal target'}),/Invalid legal target/);n++;
assert.throws(()=>run(old(),accepted(),genericError,'responsePassNoStuck'),/Runtime action|rejected/);n++;
const ok=run(old(),accepted());assert.equal(ok.ok,true);assert.equal(ok.normalizedTerminalContinuation,true);n++;
const direct=normalizePvpEngineOutcome({bridge:{applyServerIntent:()=>({ok:true}),getCanonicalSnapshot:()=>({appState:old()})},readPending:()=>null,name:'commitOpponentManaSelection'});
assert.equal(direct.ok,true);n++;
console.log('PASS Stage1 outcome adapter rejects unproven donor false; accepts verified continuation:',n,'checks');
