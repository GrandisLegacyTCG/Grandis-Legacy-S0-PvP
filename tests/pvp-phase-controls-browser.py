"""Chromium: real PvP CSS cascade + responsive stage on controlled DOM, not a live match."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/'public'/'battle'
source=(ROOT/'index.html').read_text()
inline=re.search(r'<style>(.*?)</style>',source,re.S).group(1)
responsive=re.search(r'<style id="gl-responsive-stage">(.*?)</style>',source,re.S).group(1)
stage=re.search(r'<script id="gl-responsive-stage-js">(.*?)</script>',source,re.S).group(1)
styles=re.findall(r'<link rel="stylesheet" href="([^?]+)\?',source)
styles=[(ROOT/f).read_text() for f in styles]
platform=(ROOT/'shared-ui/pvp-platform.js').read_text()
js=(ROOT/'shared-app/app-runtime.js').read_text()
lock=js[js.index('function adaptiveStageActive()'):js.index('const IDENTITY_MAX_CHARS')]+js[js.index('let phaseActionWidthMobile='):js.index('function negativeStatusName')]
html='''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div class="app"><main class="battlefield"><section class="opponent-field"></section><section class="phase"><div class="phase-turn"><div class="turn">YOUR TURN<small>TURN 3</small></div></div><div class="phase-track"><span class="phase-label">DRAW PHASE</span><span class="phase-label active">DEPLOY PHASE</span><span class="phase-label">BATTLE PHASE</span><span class="phase-label">REFORM PHASE</span><span class="phase-label">END PHASE</span></div><div class="phase-actions"><button class="phase-action" id="phasePrimaryAction" style="width:35px">REPOSITION</button><button class="phase-action next">NEXT PHASE</button></div></section><section class="player-field"></section><section class="bottom-hud"></section><div class="gl-focus-dimmer"></div></main><aside class="sidebar"></aside></div></body></html>'''
measure='''()=>{const b=document.querySelector('#phasePrimaryAction'),n=document.querySelector('.phase-action.next'),p=b.closest('.phase'),r=document.createRange();r.selectNodeContents(b);const t=r.getBoundingClientRect(),a=b.getBoundingClientRect(),z=n.getBoundingClientRect(),q=p.getBoundingClientRect(),s=getComputedStyle(b);return{contains:t.left>=a.left-.6&&t.right<=a.right+.6&&t.top>=a.top-.6&&t.bottom<=a.bottom+.6,center:Math.max(Math.abs((t.left+t.right-a.left-a.right)/2),Math.abs((t.top+t.bottom-a.top-a.bottom)/2)),separate:z.left>=a.right-.5||z.top>=a.bottom-.5,railContains:z.right<=q.right+.6&&z.bottom<=q.bottom+.6&&a.left>=q.left-.6&&a.top>=q.top-.6,width:b.offsetWidth,height:b.offsetHeight,phaseZ:getComputedStyle(p).zIndex,z:s.zIndex,opacity:s.opacity,animation:s.animationName,color:s.color,bg:s.backgroundColor,disabled:b.disabled,coarse:matchMedia('(pointer: coarse)').matches}}'''
ua='Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    for w,h,touch in [(320,568,True),(390,844,True),(844,390,True),(430,932,False),(844,390,False)]:
        page=browser.new_page(viewport={'width':w,'height':h},has_touch=touch,is_mobile=touch,user_agent=ua)
        page.set_content(html)
        for css in [inline,responsive]+styles:page.add_style_tag(content=css)
        page.evaluate(platform);page.evaluate(stage)
        page.wait_for_function("document.documentElement.classList.contains('gl-pvp-mobile-gameplay')")
        page.add_script_tag(content="const primary=document.getElementById('phasePrimaryAction');"+lock)
        # Even an undersized pre-stage inline width must not clip REPOSITION.
        before=page.evaluate(measure);assert before['contains'],(w,h,touch,before)
        page.evaluate('lockPrimaryActionWidth()')
        widths=[]
        for label in ['REPOSITION','PASS','CANCEL']:
            page.evaluate('''label=>{const b=document.querySelector('#phasePrimaryAction'),f=b.closest('.battlefield');b.textContent=label;b.className='phase-action'+(label==='PASS'?' gl-pass':label==='CANCEL'?' gl-cancel':'');f.classList.toggle('gl-focus-response',label==='PASS');f.classList.toggle('gl-focus-payment',label==='CANCEL');f.querySelector('.gl-focus-dimmer').classList.toggle('is-visible',label!=='REPOSITION')}''',label)
            result=page.evaluate(measure);widths.append(result['width'])
            assert result['contains'] and result['center']<1.5 and result['separate'] and result['railContains'],(w,h,touch,label,result)
            if label=='PASS':assert result['phaseZ']=='940' and result['z']=='4' and result['opacity']=='1' and result['animation']=='glResponsePassReminder',result
            if label=='CANCEL':assert result['phaseZ']=='940' and result['z']=='4',result
        assert max(widths)-min(widths)<=1,widths
        page.evaluate("primary.className='phase-action gl-pass';primary.textContent='PASS';primary.disabled=true")
        assert page.evaluate(measure)['animation']=='none'
        print('PASS mobile phase controls',w,h,'coarse=',before['coarse'],'width=',widths[0])
        page.close()
    page=browser.new_page(viewport={'width':1600,'height':747});page.set_content(html)
    for css in [inline,responsive]+styles:page.add_style_tag(content=css)
    page.evaluate("document.getElementById('phasePrimaryAction').style.width=''")
    before=page.evaluate(measure)
    assert before['height']==24 and before['animation']=='none',before
    print('PASS desktop donor baseline height and no mobile animation')
    browser.close()
