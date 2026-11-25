"""Actual RC43 PvP UI helpers running in Chromium with controlled DOM fixtures.
Not a navigated battle, Android device or live 2-seat acceptance test.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'battle'
RUNTIME = (ROOT/'shared-app/app-runtime.js').read_text()
STYLE = (ROOT/'runtime/pvp-vsai-rc43-ui.css').read_text()
PLATFORM = (ROOT/'shared-ui/pvp-platform.js').read_text()

def between(a,b):
    start=RUNTIME.index(a);end=RUNTIME.index(b,start)
    return RUNTIME[start:end]

FIT=between('function fitCollectionPopup(){','function limitReturnToHandSearchRows(){')
MASK=between("let handSpotlightFrame=0,handSpotlightSignature='';",'function fitCollectionPopup(){')
CSS_BASE="""
*{box-sizing:border-box}html,body{margin:0;overflow:hidden;background:#132030;color:#eee;font:14px Arial}
.gl-vsai-choice-overlay{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:10px;background:rgba(0,0,0,.4)}
.choice-panel{display:flex;flex-direction:column;border:1px solid #d1b55e;background:#08121f;border-radius:9px;width:90%;max-height:90%;min-height:0;overflow:hidden;padding:0}
.choice-head{padding:12px;border-bottom:1px solid #d1b55e}.choice-head h2{font-size:17px;margin:0}
.choice-body{min-height:0;max-height:100%;overflow:auto;padding:10px;flex:1 1 auto}
.choice-instruction{margin:0 0 9px}.choice-grid{display:grid;grid-template-columns:repeat(5,96px);gap:8px;overflow:auto}
.card-search-choice{padding:5px;display:flex;flex-direction:column;gap:4px;border:1px solid #456;background:#14233b}
.card-search-choice img{width:100%;aspect-ratio:5/7;display:block;background:#d9ae58}
.card-search-choice span{font-size:11px;line-height:1.2;display:block;min-height:14px}
.card-search-choice button{font-size:10px;padding:4px;min-height:24px}
.choice-foot{height:43px;flex:0 0 43px;display:flex;align-items:center;justify-content:center}
.gl-result-card{margin:5px}.gl-result-buttons button{height:34px;font-size:10px}
.hand.bottom .hand-track{display:flex;position:relative}.hand-card{position:relative;width:81px;height:113px}.hand-art{width:100%;height:100%;display:block}
.card-actions{position:absolute;bottom:100%;display:flex;flex-direction:column}
"""
HTML="""<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>
<body><div id='choiceOverlay' class='gl-vsai-choice-overlay open gl-collection-popup'><section class='choice-panel'>
<header class='choice-head'><h2>Select a card</h2></header><div class='choice-body'><p class='choice-instruction'>Pick one card from these available choices.</p><div class='choice-grid'></div></div>
<footer class='choice-foot'><button>CONFIRM</button></footer></section></div>
<section class='gl-result-card'><div class='gl-result-buttons'><button class='gl-result-close'>CLOSE</button><button class='gl-result-back'>BACK TO LOBBY</button></div></section>
<section class='hand bottom'><div class='hand-track' style='--gl-hand-action-scale:0.7'><div class='hand-card'><img class='hand-art' alt='Card'><div class='card-actions'><button>PLAY</button><button>TRIBUTE</button></div></div></div></section>
</body></html>"""

results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for label,ua,touch,expected in [
        ('desktop', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36',False,'desktop'),
        ('touch-laptop', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36',True,'desktop'),
        ('android-phone','Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',True,'mobile'),
        ('iphone','Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1 Mobile/15E148',True,'mobile'),
    ]:
        ctx=browser.new_context(viewport={'width':390 if expected=='mobile' else 1600,'height':844 if expected=='mobile' else 900},user_agent=ua,has_touch=touch)
        page=ctx.new_page();page.set_content(HTML)
        profile=page.evaluate('''(code)=>{new Function('window','document','navigator','location',code)(window,document,navigator,{search:''});return document.documentElement.dataset.glPlatform}''',PLATFORM)
        assert profile==expected,(label,profile,expected)
        override=page.evaluate('''code=>{new Function('window','document','navigator','location',code)(window,document,navigator,{search:'?platform='+ (document.documentElement.dataset.glPlatform==='mobile'?'desktop':'mobile')});return document.documentElement.dataset.glPlatform}''',PLATFORM)
        assert override!=profile,label
        results.append({'platform':label,'detected':profile,'override':override})
        ctx.close()
    for label,dimensions,mobile in [('desktop-1600x900',(1600,900),False),('desktop-1120x560',(1120,560),False),('mobile-logical',(844,390),True)]:
        ctx=browser.new_context(viewport={'width':dimensions[0],'height':dimensions[1]})
        page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(HTML)
        page.add_style_tag(content=CSS_BASE+STYLE)
        page.evaluate('''({mobile})=>{const root=document.documentElement;root.dataset.glPlatform=mobile?'mobile':'desktop';if(mobile){root.classList.add('gl-adaptive-stage','gl-pvp-mobile-gameplay','gl-stage-landscape');root.style.setProperty('--gl-stage-logical-w','1600px');root.style.setProperty('--gl-stage-logical-h','747px');document.querySelector('.gl-vsai-choice-overlay').style.width='1600px';document.querySelector('.gl-vsai-choice-overlay').style.height='747px';}}''',{'mobile':mobile})
        page.evaluate("document.querySelector('.choice-grid').innerHTML=Array.from({length:56},(_,i)=>`<article class='card-search-choice'><img alt='Card'><span>Card ${i+1} - Name</span><button>Select</button></article>`).join('')")
        page.add_script_tag(content="const choiceOverlay=document.getElementById('choiceOverlay');function adaptiveStageActive(){return document.documentElement.classList.contains('gl-adaptive-stage')}"+FIT)
        page.evaluate('fitCollectionPopup()')
        geom=page.evaluate('''()=>{const over=choiceOverlay,panel=over.querySelector('.choice-panel'),g=over.querySelector('.choice-grid'),cards=[...g.children],root=document.documentElement;
          const cols=Number(over.dataset.collectionColumns),first=cards[0];let visible=0;for(let i=0;i<cards.length;i+=cols){const row=cards.slice(i,i+cols);if(Math.max(...row.map(x=>x.offsetTop+x.offsetHeight))-first.offsetTop<=g.clientHeight+1)visible++;}
          return {cols,visible,rows:Math.ceil(cards.length/cols),panelTop:panel.offsetTop,panelH:panel.offsetHeight,gridH:g.clientHeight,gridScrollH:g.scrollHeight,stageH:parseFloat(root.style.getPropertyValue('--gl-stage-logical-h'))||innerHeight};}''')
        assert not errors,(label,errors)
        assert 1<=geom['cols']<=56,(label,geom)
        assert geom['visible']>=2,(label,geom)
        assert geom['panelTop']<70,(label,geom)
        assert geom['panelTop']+geom['panelH']<=geom['stageH']+3,(label,geom)
        assert geom['gridScrollH']>=geom['gridH'],(label,geom)
        results.append({'collection':label,**geom})
        page.evaluate('resetCollectionPopup()')
        assert page.evaluate('''()=>!choiceOverlay.classList.contains('gl-collection-popup')&&!choiceOverlay.querySelector('.choice-panel').style.getPropertyValue('max-height')''')
        page.evaluate("document.documentElement.dataset.glPlatform='mobile';document.documentElement.classList.add('gl-adaptive-stage')")
        buttons=page.evaluate('''()=>{const b=document.querySelector('.card-actions button'),c=getComputedStyle(b);return{font:c.fontSize,width:c.width,height:c.height}}''')
        assert float(buttons['width'][:-2])>15 and float(buttons['height'][:-2])>7,buttons
        page.evaluate("document.querySelector('.hand-track').style.setProperty('--gl-hand-action-scale','0.5')")
        shrink=page.evaluate("parseFloat(getComputedStyle(document.querySelector('.card-actions button')).width)")
        assert shrink<float(buttons['width'][:-2]),(buttons,shrink)
        resultBtns=page.evaluate('''()=>[...document.querySelectorAll('.gl-result-buttons button')].map(x=>[getComputedStyle(x).height,getComputedStyle(x).fontSize])''')
        assert all(v==['34px','10px'] for v in resultBtns),resultBtns
        ctx.close()
    # Reuse the true RC43 mask builder and geometry code without loading PvP authority.
    ctx=browser.new_context(viewport={'width':1600,'height':900})
    page=ctx.new_page();page.set_content(HTML)
    page.add_style_tag(content=CSS_BASE+STYLE)
    page.evaluate("""()=>{document.documentElement.dataset.glPlatform='desktop';document.getElementById('choiceOverlay').classList.remove('gl-collection-popup');document.getElementById('choiceOverlay').classList.add('gl-choice-to-hand');
      const track=document.querySelector('.hand-track');track.replaceChildren(...Array.from({length:3},(_,i)=>{const el=document.createElement('div');el.className='hand-card'+(i===1?' gl-presentation-hidden':'');el.style.cssText='width:81px;height:113px;position:absolute;left:'+(360+i*100)+'px;top:600px';const img=document.createElement('img');img.className='hand-art';img.style.cssText='width:81px;height:113px';el.appendChild(img);return el}));
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('gl-choice-hand-window');svg.innerHTML='<defs><mask id="glChoiceHandArtMask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" style="mask-type:luminance"><rect width="100%" height="100%" fill="white"/><g class="gl-hand-mask-cards" fill="black"/></mask></defs><rect width="100%" height="100%" fill="rgba(0,0,0,.72)" mask="url(#glChoiceHandArtMask)"/>';document.getElementById('choiceOverlay').prepend(svg);
    }""")
    page.add_script_tag(content="const choiceOverlay=document.getElementById('choiceOverlay'),choiceHandWindow=choiceOverlay.querySelector('.gl-choice-hand-window'),playerHandTrack=document.querySelector('.hand-track'),handMaskNS='http://www.w3.org/2000/svg';let glHandSearchSessionKey='',glPvpMobileListScrollSession='';function pvpLandscapeStage(){return false}function uiRect(el){return el.getBoundingClientRect()}function currentUiScale(){return 1}function fitCollectionPopup(){}"+MASK)
    page.evaluate('positionReturnToHandSearch()')
    mask=page.evaluate('''()=>({rectCount:choiceHandWindow.querySelectorAll('.gl-hand-mask-cards rect').length,viewBox:choiceHandWindow.getAttribute('viewBox')})''')
    assert mask=={'rectCount':2,'viewBox':'0 0 1600 900'},mask
    page.evaluate("document.querySelector('.hand-card:not(.gl-presentation-hidden)').classList.add('gl-presentation-hidden');positionReturnToHandSearch()")
    assert page.evaluate("choiceHandWindow.querySelectorAll('.gl-hand-mask-cards rect').length")==1
    page.evaluate("resetReturnToHandSearchDisplay()")
    assert page.evaluate("choiceHandWindow.querySelectorAll('.gl-hand-mask-cards rect').length")==0
    results.append({'handMask':mask,'hiddenCardNeverCutOut':True,'reset':True})
    ctx.close()
    browser.close()
print('PASS RC43 browser fixture: platform 4 profiles/overrides, collection 3 size classes, visible 2+ rows, proportional Hand actions, Game Result, exact Hand SVG mask')
print(json.dumps(results,indent=2))
