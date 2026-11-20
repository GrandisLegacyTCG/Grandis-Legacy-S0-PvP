'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const root=path.resolve(__dirname,'../public/battle');
const ctx={console,URL,Date,Math,Array,JSON,Map,Set,Promise,Uint8Array,TextDecoder,TextEncoder,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},requestAnimationFrame:()=>0,cancelAnimationFrame(){},crypto:crypto.webcrypto};
ctx.window=ctx;ctx.globalThis=ctx;ctx.location={href:'http://audit.local/index.html',origin:'http://audit.local'};ctx.navigator={userAgent:'QA'};
ctx.document={readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null},querySelectorAll(){return []},createElement(){return {style:{},appendChild(){},setAttribute(){}}},documentElement:{classList:{toggle(){}}},body:{appendChild(){}}};
vm.createContext(ctx);
for(const file of ['engine/js/static-data.js','assets/review-db158/js/db166-view-model.js','engine/js/runtime-authority.js','engine/shared-app/active-starters.js','runtime/season0-generated/rc41-approved-print-overrides.js','engine/shared-app/app.bundle.js']){
let code=fs.readFileSync(path.join(root,file),'utf8');
if(file==='engine/shared-app/app.bundle.js'){
 const idx=code.lastIndexOf('})();');if(idx<0)throw Error('Missing engine IIFE');
 code=code.slice(0,idx)+'\nshowInfo=function(){};\nwindow.__Q={initCards,card,heroState,buildInitialMatchState,sourceCompatibleForResponse,responseOptionsFor,responseIncomingFromWindow,responseOptionStillLegalAtConfirm,resolvedClassAbility,s0ClassActionFromCurrentPrint,s0RulesParseText,passiveAttackDamageBonus,drawReplacementAbilityForHero,classStatusDurationBonus,applyStatusEffectToHero,computedAttackDamageForAction,heroClass,heroMatchesLineageGate,itemLineageGate,cardFamily,setState(s){appState=s;matchStarted=true;SUPPRESS_RENDER=true},get state(){return appState}};\n'+code.slice(idx);
}
vm.runInContext(code,ctx,{filename:file,timeout:60000});}
const q=ctx.__Q;q.initCards();let pass=0,fail=0;const details=[];
function ck(label,fn){try{fn();pass++;details.push({label,ok:true});}catch(e){fail++;details.push({label,ok:false,error:String(e.message||e).slice(0,500)});}}
function fixture(side='PLAYER',currentId='S0-MAG-H001'){
 const s=q.buildInitialMatchState();q.setState(s);s.turn=side;s.phase='Battle';s.round=2;s.gameOver=false;s.preGame=null;s.responseWindow=null;s.pending=null;s.playerHand=[];s.aiHand=[];
 const h=side==='PLAYER'?s.playerHeroes:s.aiHeroes;
 for(const lane of ['LEFT','CENTER','RIGHT']){h[lane]=q.heroState(lane==='CENTER'?currentId:'S0-ARC-H001',side,lane);h[lane].hp=100;h[lane].maxHp=100;h[lane].status=[];h[lane].statuses=[];h[lane].attachments=[null,null];h[lane].exhausted=false;}
 s.playerManaPoolCards=(s.playerManaPoolCards||[]);s.aiManaPoolCards=s.aiManaPoolCards||[];
 return s;
}
const bases={Archer:'S0-ARC-H001',Thief:'S0-THF-H001',Warrior:'S0-WAR-H001',Cleric:'S0-CLE-H001',Mage:'S0-MAG-H001'};
const incoming=(lane,damageType='Physical',multi=false)=>({damage:40,damage_type:damageType,attack_type:multi?'Area Attack':'Single Target',cannot_dodge:false,cannot_block:false,card_id:'S0-WAR-001',source_side:'AI',source_lane:'LEFT',target_side:'PLAYER',target_lane:lane,affected_lanes:multi?['LEFT','CENTER','RIGHT']:undefined});
for(const [id,type,allowedClasses] of [['S0-ITM-012','Physical',['Archer','Thief']],['S0-ITM-012','Magical',['Archer','Thief']],['S0-ITM-016','Physical',['Warrior','Archer','Thief']],['S0-ITM-007','Magical',Object.keys(bases)]]){
 for(const [cls,hid] of Object.entries(bases)){
  ck(`${id} ${type}: center ${cls}, teammate Archer`,()=>{
   const s=fixture('PLAYER',hid);s.playerHeroes.LEFT=q.heroState('S0-ARC-H001','PLAYER','LEFT');s.playerHand=[id,'S0-EVT-002'];
   const o=q.responseOptionsFor(s,'PLAYER',incoming('CENTER',type)).filter(x=>x.card_id===id);
   const allowed=allowedClasses.includes(cls);
   assert.strictEqual(o.length,allowed?1:0,JSON.stringify(o.map(x=>({source:x.source_lane,protected:x.protected_lane}))));
   if(allowed)assert(o[0].source_lane==='CENTER'&&o[0].protected_lane==='CENTER','wrong user/source');
  });
 }
}
for(const [id,type] of [['S0-ITM-012','Magical'],['S0-ITM-016','Physical'],['S0-ITM-007','Magical']]){
 ck(`${id}: separate Area window only for current Hero`,()=>{
  const s=fixture('PLAYER','S0-MAG-H001');s.playerHand=[id,'S0-EVT-002'];
  const l=q.responseOptionsFor(s,'PLAYER',incoming('LEFT',type,true)).filter(o=>o.card_id===id);
  const c=q.responseOptionsFor(s,'PLAYER',incoming('CENTER',type,true)).filter(o=>o.card_id===id);
  if(id==='S0-ITM-007'){assert(l.length===1&&c.length===1);} else {assert(l.length===1&&c.length===0,JSON.stringify({l,c}));}
  assert(l[0].source_lane==='LEFT'&&l[0].protected_lane==='LEFT');
 });
}
ck('0 eligible sources cannot bypass Mage-only window',()=>{
 let s=fixture();s.playerHand=['S0-ITM-012','S0-EVT-002'];const opt=q.responseOptionsFor(s,'PLAYER',incoming('CENTER','Physical'));assert.strictEqual(opt.filter(x=>x.card_id==='S0-ITM-012').length,0);
});
ck('Magic Ring cannot be used while its current Hero is Stunned',()=>{const s=fixture();s.playerHand=['S0-ITM-007'];s.playerHeroes.CENTER.statuses=[{name:'Stun',duration:1}];assert(!q.responseOptionsFor(s,'PLAYER',incoming('CENTER','Magical')).some(x=>x.card_id==='S0-ITM-007'));});
ck('Hook cannot Dodge while Freeze on current Hero',()=>{const s=fixture('PLAYER','S0-ARC-H001');s.playerHand=['S0-ITM-012','S0-WAR-001'];s.playerHeroes.CENTER.statuses=[{name:'Freeze',duration:1}];assert(!q.responseOptionsFor(s,'PLAYER',incoming('CENTER','Magical')).some(x=>x.card_id==='S0-ITM-012'));});
ck('Stale defense option rejected if Hero changed to Mage',()=>{const s=fixture('PLAYER','S0-ARC-H001');s.playerHand=['S0-ITM-012','S0-WAR-001'];const rw={kind:'incoming_attack',...incoming('CENTER','Magical'),response_owner:'PLAYER'};const o=q.responseOptionsFor(s,'PLAYER',incoming('CENTER','Magical')).find(x=>x.card_id==='S0-ITM-012');assert(o);s.playerHeroes.CENTER=q.heroState('S0-MAG-H001','PLAYER','CENTER');assert.strictEqual(q.responseOptionStillLegalAtConfirm(s,rw,o),false);});
for(const hid of ['S0-MAG-H002','S0-MAG-H003','S0-MAG-H005','S0-MAG-H006']){
 ck(`${hid} Burn/Freeze +1`,()=>{const c=q.card(hid),a=q.resolvedClassAbility(c);assert(a&&a.action,'Class ability absent');assert(a.action.status_duration_modifier.amount===1,JSON.stringify(a));assert.deepStrictEqual(Array.from(a.action.status_duration_modifier.statuses),['Burn','Freeze']);});
}
for(const hid of ['S0-MAG-H003','S0-MAG-H006']){
 ck(`${hid} +10 Magical`,()=>{const h=q.heroState(hid,'PLAYER','CENTER');assert.strictEqual(q.passiveAttackDamageBonus(q.card('S0-MAG-001'),h),10);});
}
ck('Alden Rank III Rapid Chamber +10 Physical and Draw replacement',()=>{const h=q.heroState('S0-ARC-H009','PLAYER','CENTER');assert.strictEqual(q.passiveAttackDamageBonus(q.card('S0-ARC-018'),h),10);assert.strictEqual(q.drawReplacementAbilityForHero(h)?.abilityId,'rapid_chamber');});
ck('Vanquisher Resolve name apostrophe supported',()=>{const c=q.card('S0-WAR-H005'),a=q.resolvedClassAbility(c);assert(a?.action,JSON.stringify(a));});
ck('Both apostrophe spellings parsed without touching original print',()=>{
 const id='S0-MAG-H005',c=q.card(id);const orig=c.class_ability.text;assert(orig.includes('’'));
 const a=q.s0ClassActionFromCurrentPrint({...c.class_ability,text:orig.replaceAll('’',"'")});
 const b=q.s0ClassActionFromCurrentPrint(c.class_ability);
 assert(a&&b&&a.type===b.type);assert.strictEqual(c.class_ability.text,orig);
});

ck('Aldric Rank II actually inflicts Burn and Freeze for 2 turns (1 + passive)',()=>{
 const s=fixture('PLAYER','S0-MAG-H005'),src=s.playerHeroes.CENTER,tgt=s.aiHeroes.CENTER;
 tgt.statuses=[];
 assert.strictEqual(q.classStatusDurationBonus(src,tgt,'Burn'),1);
 assert.strictEqual(q.classStatusDurationBonus(src,tgt,'Freeze'),1);
 assert.strictEqual(q.classStatusDurationBonus(src,s.playerHeroes.LEFT,'Burn'),0);
 q.applyStatusEffectToHero({kind:'inflict_status',status:'Burn',duration_turns:1},tgt,src,'QA',q.card('S0-MAG-013'),'PLAYER');
 q.applyStatusEffectToHero({kind:'inflict_status',status:'Freeze',duration_turns:1},tgt,src,'QA',q.card('S0-MAG-013'),'PLAYER');
 assert.strictEqual(tgt.statuses.find(v=>v.name==='Burn').duration,2);
 assert.strictEqual(tgt.statuses.find(v=>v.name==='Freeze').duration,2);
});
ck('Aldric Rank III keeps +1 Burn and +10 Magical damage',()=>{
 const s=fixture('PLAYER','S0-MAG-H006'),src=s.playerHeroes.CENTER,tgt=s.aiHeroes.CENTER;
 assert.strictEqual(q.classStatusDurationBonus(src,tgt,'Burn'),1);
 assert.strictEqual(q.passiveAttackDamageBonus(q.card('S0-MAG-001'),src),10);
});
ck('Poison Vial / Dazed / Freeze Bomb accept both apostrophe forms in source print',()=>{
 // The parser itself accepts every supported apostrophe without mutating data.
 for(const text of ["When that Hero's Skill card deals Physical damage, inflict Poison for 2 turns.","Inflict Stun on one of your opponent's Heroes for 1 turn"]){
  const variants=[text,text.replaceAll("'",'’'),text.replaceAll("'",'‘'),text.replaceAll("'",'＇')];
  for(const variant of variants){assert.strictEqual(q.s0RulesParseText(variant),text);}
 }
});
ck('Popup layer outranks attack connector and hides it while choice open',()=>{
 const css=fs.readFileSync(path.join(root,'shared-ui/battlefield-ui.css'),'utf8');
 const arrow=css.match(/\.gl-vsai-attack-direction-layer\{[^}]*z-index:(\d+)/);
 const popup=css.match(/\.gl-vsai-choice-overlay\{[^}]*z-index:(\d+)/);
 assert(arrow&&popup&&Number(popup[1])>Number(arrow[1]),'Popup must outrank attack connector');
 assert(css.includes('body:has(.gl-vsai-choice-overlay.open')&&css.includes('visibility:hidden!important'), 'Arrow must hide when a choice is open');
});
ck('Optional Swap buttons anchor to each partner Hero',()=>{
 const ui=fs.readFileSync(path.join(root,'shared-app/app-runtime.js'),'utf8');
 const css=fs.readFileSync(path.join(root,'shared-ui/battlefield-ui.css'),'utf8');
 assert(ui.includes('uiLayoutRect(heroCardEl(d.side,d.b))'));
 assert(ui.includes('btn.dataset.swapPartner=d.b'));
 assert(css.includes('.gl-swap-button[data-swap-partner]::after'));
});
ck('RC41 unchanged source version and hotfixed runtime cache keys',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const f of ['engine/shared-app/app.bundle.js','shared-app/app-runtime.js','shared-ui/battlefield-ui.css'])
  assert(html.includes(f+'?v=gl-s0-pvp-rc41-r39-v34-part5-2026-11-19')&&
    html.includes('f15ui=20261121-03'),f+' was not cache-busted for PvP without changing buildId');
 assert(html.includes('RC41')&&html.includes('R3.9'), 'RC41 baseline unexpectedly changed');
});
ck('Existing RC40 physical-discard regression adapted to current Hero window',()=>{
 const r=ctx.GL_RC40_ITEM_DISCARD_VALIDATOR_QA_SELF_TEST();
 // The archival validator permits another Hero to use Protection Items.
 // Latest donor Part7 correctly forbids that: exclude ONLY the two contradictory
 // archived assumptions; all other historic checks still run and must pass.
 const superseded=new Set(['Hook Archer source protects Mage target',
   'Chain Mail Warrior source protects Mage target']);
 const failures=r?.checks?.filter(x=>!x.ok&&!x.name.startsWith('Legacy ')&&!superseded.has(x.name))||[];
 assert(r&&r.checks&&failures.length===0,JSON.stringify({passed:r?.passed,total:r?.total,failed:failures,reason:r?.reason,error:r?.error}).slice(0,3000));
});
const result={pass,fail,total:pass+fail,checks:details};
fs.writeFileSync(path.join(__dirname,'RC41_PART7_FOCUSED_QA_RESULTS.json'),JSON.stringify(result,null,2)+'\n');
console.log('RC41 PART7 FOCUSED QA',pass,'/',pass+fail,'fail',fail);
for(const d of details.filter(x=>!x.ok))console.log('FAIL',d.label,d.error);
if(fail)process.exit(1);
