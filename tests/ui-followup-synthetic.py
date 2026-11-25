"""Source-derived browser fixture, not a navigated two-player match.
Synthetic DOM exercises adopted donor geometry and status tap without network authority.
"""
from pathlib import Path
import re, json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/'public'/'battle'
src=(ROOT/'shared-app/app-runtime.js').read_text()
css=(ROOT/'runtime/pvp-vsai-followup-20261125.css').read_text()

def between(start, end):
    a=src.index(start);b=src.index(end,a);return src[a:b]

functions=(between('function playedCardCapacity(){','function fitPlayedCards(){')+
           between('/* Direct action card geometry shared by all center modes','function resetCenterChoiceVisualState(){')+
           between('function layoutAdaptiveHand(track,side){','function syncPlayerManaPoolToHeroLeft(){')+
           between('// Mobile status info is a read-only tap portal, independent','function renderStatuses(laneEl,h,s,side,lane,delayExhaust){'))
setup="""
const centerChoiceStage=document.getElementById('center');
const choiceOverlay=document.getElementById('swapOverlay');
const playedGrid=document.querySelector('.played');
const BF=document.querySelector('.battlefield');
function adaptiveStageActive(){return document.documentElement.classList.contains('gl-adaptive-stage')}
function pvpLandscapeStage(){return document.documentElement.classList.contains('gl-pvp-mobile-gameplay')}
function uiLayoutRect(el){return el?.getBoundingClientRect?.()||null}
function uiLaneElement(side,lane){return document.querySelector('.hero-lane[data-side="'+side+'"][data-lane="'+lane+'"]')}
"""
html="""<!doctype html><html><head><style>
:root{--hero-base-w-logical:108px;--gl-stage-logical-w:1600px;--gl-stage-logical-h:747px}
*{box-sizing:border-box}
body{margin:0;background:#152030;color:white}
.app{width:1600px;height:747px;display:flex}
.battlefield{width:1360px;height:747px;position:relative}
.hero-card{width:126px;height:176px}
.gl-center-choice-stage{position:absolute;left:0;top:0;width:1600px;height:747px;padding:20px 32px;display:flex;flex-direction:column;gap:12px;align-items:center}
.gl-center-choice-copy{height:105px;width:50%;flex:0 0 105px}
.gl-center-choice-cards{display:flex;width:1400px;height:450px;align-items:center;justify-content:center;gap:8px;padding:44px 24px 12px}
.gl-center-choice-card{display:block;background:#583b32;border:1px solid gold}
.gl-center-choice-actions{height:50px;width:45%;display:flex;align-items:center;flex:0 0 50px}
.gl-vsai-choice-overlay{position:absolute;left:0;top:0;width:780px;height:500px;display:none}
.sidebar{height:747px;width:240px;display:grid;grid-template-rows:70px auto minmax(0,1fr) 22px;row-gap:8px}
.sidebox{border:1px solid gold;padding:6px;display:flex;flex-direction:column;gap:8px}
.played{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;width:204px}
.played-card{display:block;width:65px;height:91px;margin-bottom:12px}
.shared-box{height:375px;display:flex;flex-direction:column}
.active-card-stage{width:220px;height:310px}
.bottom-actions{height:22px}
.hero-lane{position:absolute;top:200px;left:120px;min-width:140px;min-height:200px}
.gl-indicator-tooltip{display:block;background:#222}
</style><style>"""+css+"""</style></head>
<body class="gl-center-choice-active"><div class="app"><main class="battlefield">
<div class="gl-hero-physical-stack"><div class="hero-card"></div></div>
<div class="hero-lane" data-side="PLAYER" data-lane="LEFT"><div class="gl-status-stack"><div class="gl-negative-status"><button class="gl-status" aria-label="Burn"><small>2</small></button><div class="gl-indicator-tooltip"><strong>Burn</strong><span>Damage each round</span></div></div></div></div>
<div id="center" class="gl-center-choice-stage open" data-gl-action-popup="1"><div class="gl-center-choice-copy">Payment</div><div class="gl-center-choice-cards"></div><div class="gl-center-choice-actions">PAY</div></div>
<div id="swapOverlay" class="gl-vsai-choice-overlay"></div></main>
<div class="sidebar"><section class="turn-box" style="height:70px">Round 1</section><section class="played-box sidebox"><h3>Card Played</h3><div class="played"><div class="played-card"></div></div><button class="history-btn">History</button></section><section class="shared-box"><div class="active-card-stage"></div></section><div class="bottom-actions">Action</div></div></div>
<button id="outside">Outside</button>
</body></html>"""
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1600,'height':900})
    page.set_content(html)
    page.add_script_tag(content=setup+functions)
    # The donor's newest direct-action cards fit the unrotated Hero: 100% desktop, 89% mobile.
    ratios={}
    for mode in ('desktop','mobile'):
        page.evaluate('''mode=>{
          document.documentElement.classList.toggle('gl-adaptive-stage',mode==='mobile');
          document.documentElement.classList.toggle('gl-pvp-mobile-gameplay',mode==='mobile');
          document.documentElement.classList.toggle('gl-stage-landscape',mode==='mobile');
          document.documentElement.dataset.uiScale=mode==='mobile'?'27':'100';
        }''',mode)
        for n in (1,3,8,12):
            stats=page.evaluate('''n=>{
              const host=centerChoiceStage.querySelector('.gl-center-choice-cards');
              host.replaceChildren(...Array.from({length:n},()=>{let x=document.createElement('div');x.className='gl-center-choice-card';return x}));
              fitCenterActionCards();const widths=[...host.children].map(el=>el.getBoundingClientRect().width);
              return {normal:directActionNormalWidth(centerChoiceStage),css:parseFloat(host.style.getPropertyValue('--gl-action-card-w')),
                widths, gap:parseFloat(host.style.getPropertyValue('--gl-action-gap')),
                available:host.clientWidth-48};
            }''',n)
            assert stats['css']>0, (mode,n,stats)
            assert all(abs(x-stats['css'])<1.1 for x in stats['widths']),(mode,n,stats)
            assert stats['css']*n+stats['gap']*(n-1)<=stats['available']+2,(mode,n,stats)
            ratios[mode,n]=stats['normal']
    assert abs(ratios['desktop',1]-126)<1,(ratios)
    assert abs(ratios['mobile',1]-126*.89)<1,(ratios)
    # Card Played adapts to available sidebar height without changing cards.
    played={}
    for h in (747,1250):
        played[h]=page.evaluate('''h=>{
          const sb=document.querySelector('.sidebar');sb.style.height=h+'px';
          return playedCardCapacity();
        }''',h)
    assert played[747]==6 and played[1250]==9,played
    # Status popup is read-only and dismisses on outside; clickable selection stays for existing gameplay.
    page.evaluate("document.documentElement.classList.add('gl-adaptive-stage','gl-pvp-mobile-gameplay','gl-stage-landscape');document.getElementById('center').classList.remove('open');document.getElementById('center').style.display='none';document.body.classList.remove('gl-center-choice-active')")
    page.locator('.gl-status').click(force=True)
    assert page.locator('.gl-mobile-status-tip.open').count()==1,'status did not open'
    assert 'Damage each round' in page.locator('.gl-mobile-status-tip').inner_text()
    page.locator('#outside').click(force=True)
    assert page.locator('.gl-mobile-status-tip.open').count()==0,'status tip stuck'
    page.evaluate('''()=>{const b=document.querySelector('.gl-status');b.classList.add('gl-clickable');b.addEventListener('click',()=>{window.__statusChoiceClicks=(window.__statusChoiceClicks||0)+1})}''')
    page.locator('.gl-status').click(force=True)
    assert page.evaluate('window.__statusChoiceClicks')==1,'status choice blocked'
    assert page.locator('.gl-mobile-status-tip.open').count()==0,'status choice showed tip'
    # Hand scales on draw/discard, retaining rail clearance; no DOM re-creation here.
    fits=page.evaluate("""()=>{
      const bf=document.querySelector('.battlefield');
      const add=(sel,x,w)=>{let el=document.createElement('div');el.className=sel;el.style.cssText='position:absolute;left:'+x+'px;top:0;width:'+w+'px;height:70px';bf.appendChild(el);return el};
      add('player-mana-pool',20,175);add('player-name identity-card',1160,160);
      const rail=add('player-right-rail',1120,150),racial=document.createElement('div');racial.className='racial-row';racial.style.cssText='width:150px;height:50px';rail.appendChild(racial);
      const hand=add('hand bottom',0,1360);hand.style.top='610px';hand.style.height='130px';
      const track=document.createElement('div');track.className='hand-track';hand.appendChild(track);
      const result=[];
      for(const n of [1,5,12]){
        track.replaceChildren(...Array.from({length:n},()=>{let c=document.createElement('div');c.className='hand-card';return c}));
        layoutAdaptiveHand(track,'PLAYER');
        const width=parseFloat(track.style.getPropertyValue('--gl-fit-hand-w'));
        const span=parseFloat(track.style.getPropertyValue('--gl-hand-space'));
        const occupied=width*n+Math.max(0,n-1)*4;
        result.push({n,width,span,occupied,dense:track.classList.contains('gl-hand-dense')});
      }
      return result;
    }""")
    assert fits[0]['width']>=fits[-1]['width']>0,fits
    assert all(x['occupied']<=x['span']+2 for x in fits),fits
    assert fits[-1]['dense'],fits
    print('PASS: donor 100%/89% action ratio; count 1/3/8/12 without overflow; 6/9 adaptive Card Played; status tap, outside close, actionable choice preserved',json.dumps({'ratios':{str(k):v for k,v in ratios.items()},'played':played,'hand':fits}))
    browser.close()
