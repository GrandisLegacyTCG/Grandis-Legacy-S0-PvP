/** Step3 READY prewarm guard: only two ready+decked desktop seats can warm a VM. */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../public/pvp/pvp-host.js',import.meta.url),'utf8');
const nodes=new Map(),sockets=[],idles=[],listeners=new Map();
function element(tag='div'){
 const e={tagName:tag.toUpperCase(),id:'',children:[],style:{removeProperty(){},setProperty(){}},dataset:{},className:'',inert:false,
  classList:{add(){},remove(){},toggle(){},contains(){return false}},querySelectorAll(){return []},querySelector(){return element()},closest(){return null},
  getAttribute(){return null},setAttribute(){},addEventListener(){},removeEventListener(){},remove(){this.removed=true;nodes.delete(this.id)},
  appendChild(k){this.children.push(k);return k},value:'',textContent:'',innerHTML:''};
 if(tag==='iframe')e.contentWindow={postMessage(){}};
 return e;
}
const doc={readyState:'complete',visibilityState:'visible',documentElement:{classList:{toggle(){}}},body:{appendChild(n){nodes.set(n.id,n)},querySelectorAll(){return []}},head:{appendChild(){}},
 getElementById:id=>nodes.get(id)||null,querySelector:q=>q==='.app'?null:element(),querySelectorAll(){return []},createElement:element,
 addEventListener(name,fn){listeners.set(name,fn)}};
for(const id of ['pvpHomeLogo','pvpSetupName','pvpSetupDeck','pvpRankPrev','pvpRankNext','pvpRankLabel',
'pvpLoadedDeckStatus','pvpFormationPreview','pvpDeckTitle','pvpDeckClassLine','pvpDeckStats',
'pvpSetupPeople','pvpSetupSpectatorButton','pvpSetupReadyButton','pvpSetupReconnectButton','pvpSetupStartButton','pvpSetupHint',
'pvpNameStateIcon','pvpImportDeckButton','pvpImportDeckInput'])nodes.set(id,element());
class Socket{
 static OPEN=1;static CONNECTING=0;
 constructor(url){this.url=url;this.readyState=0;sockets.push(this)}
 send(){}
 open(){this.readyState=1;this.onopen?.({})}
 receive(m){this.onmessage?.({data:JSON.stringify(m)})}
}
const sessions=new Map(),storage=new Map(),subscribers=new Map();
const ctx={window:null,globalThis:null,document:doc,WebSocket:Socket,JSON,Date,Math,URL,URLSearchParams,Map,Set,Promise,
 navigator:{deviceMemory:8,maxTouchPoints:5,connection:{saveData:false}},
 performance:{now:()=>1},crypto:{randomUUID:()=> 's3-test'},
 Image:class{decode(){return Promise.resolve()}set src(_){}},MutationObserver:class{observe(){}},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
 sessionStorage:{getItem:k=>sessions.get(k)||null,setItem:(k,v)=>sessions.set(k,v),removeItem:k=>sessions.delete(k)},
 location:{origin:'https://unit.invalid',protocol:'https:',host:'unit.invalid',href:'https://unit.invalid/',pathname:'/',search:'',replace(){throw Error('No navigation')}} ,
 setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},clearInterval(){},
 requestIdleCallback(fn){idles.push(fn);return idles.length},CustomEvent:class{},dispatchEvent(){},addEventListener(name,fn){subscribers.set(name,fn)},
 GL_PVP_BUILD_META:{buildId:'test-step3',versionLabel:'Step3'},GL_PVP_CONFIG:{},GL_S0_LOBBY_STARTERS:{},GL_S0_LOBBY_CARD_DEFINITIONS:{cards:[]}};
ctx.window=ctx;ctx.globalThis=ctx;
vm.runInNewContext(src,ctx,{filename:'pvp-host.js'});
const ws=sockets[0];ws.open();
const snap=(ready,ready2=ready,hasDeck=true)=>({type:'snapshot',match:{status:'setup',revision:0},local:{seat:1,role:'player',ready,clientId:'a'},
 players:[{seat:1,role:'player',connected:true,ready,hasDeck},{seat:2,connected:true,ready:ready2,hasDeck}]});
function drain(){while(idles.length)idles.shift()({didTimeout:false,timeRemaining:()=>30})}
ws.receive(snap(true,true));drain();assert.equal(nodes.has('glPvpBattleStage'),false,'mobile must never instantiate hidden engine');
ctx.navigator.maxTouchPoints=0;ctx.navigator.deviceMemory=4;
ws.receive(snap(true,true));drain();assert.equal(nodes.has('glPvpBattleStage'),false,'<=4GB laptop must avoid double VM');
ctx.navigator.deviceMemory=8;
ws.receive(snap(true,false));drain();assert.equal(nodes.has('glPvpBattleStage'),false,'second seat not ready');
ws.receive(snap(true,true));drain();assert.equal(nodes.get('glPvpBattleStage')?.inert,true,'desktop with two ready seats may prewarm');
doc.visibilityState='hidden';listeners.get('visibilitychange')();assert.equal(nodes.has('glPvpBattleStage'),false,'hidden prewarmed stage released');
doc.visibilityState='visible';listeners.get('visibilitychange')();drain();assert.equal(nodes.get('glPvpBattleStage')?.inert,true,'re-visible desktop can resume prewarm');
ws.receive(snap(false));assert.equal(nodes.has('glPvpBattleStage'),false,'UNREADY releases idle stage');
assert.equal(sockets.length,1,'one socket only');
console.log('PASS STEP3 mobile/constrained RAM prewarm disabled; desktop READY-only; hidden tab cleanup; 1 socket');
