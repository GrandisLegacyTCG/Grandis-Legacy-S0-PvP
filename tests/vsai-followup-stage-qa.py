"""Synthetic stage/viewport QA, not a navigated two-browser multiplayer match."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json,re
root=Path(__file__).resolve().parents[1]/'public'/'battle'
s=(root/'index.html').read_text()
inline_css=re.search(r'<style>(.*?)</style>',s,re.S).group(1)
responsive_css=re.search(r'<style id="gl-responsive-stage">(.*?)</style>',s,re.S).group(1)
stage_js=re.search(r'<script id="gl-responsive-stage-js">(.*?)</script>',s,re.S).group(1)
styles=['shared-ui/battlefield-ui.css','runtime/pvp-mobile-landscape-fix.css','runtime/pvp-mobile-all5.css','runtime/pvp-mobile-followup.css','runtime/pvp-mobile-vsai-batch2-parity.css','runtime/pvp-ui-sync.css','runtime/pvp-vsai-followup-20261125.css']
html='''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>
<div class="app"><main class="battlefield"><section class="opponent-field"><div class="hero-lane"><div class="gl-hero-physical-stack"><div class="hero-card"></div></div></div></section>
<section class="phase"><div class="phase-track"><span class="phase-label active">Battle</span></div></section>
<section class="player-field"><div class="hero-lane"><div class="gl-hero-physical-stack"><div class="hero-card"></div></div><div class="gl-hp-overlay"><span class="gl-hp-text">50 / 50</span></div></div></section>
<section class="bottom-hud"><section class="hand bottom"><div class="hand-track"><div class="hand-card"></div></div></section></section></main>
<aside class="sidebar"><div class="played-box"><div class="played" data-gl-played-rows="3"></div></div></aside></div></body></html>'''
rows=[]
with sync_playwright() as playwright:
    browser=playwright.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for w,h,mobile in [(320,568,True),(390,844,True),(844,390,True),(430,932,True),(720,393,True),(738,1370,True),(1440,900,False)]:
        ctx=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile,device_scale_factor=1)
        page=ctx.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(html)
        for css in [inline_css,responsive_css]+[(root/f).read_text() for f in styles]:page.add_style_tag(content=css)
        page.evaluate(stage_js)
        page.wait_for_timeout(60)
        if mobile:page.evaluate("document.documentElement.classList.add('gl-pvp-mobile-gameplay')")
        page.wait_for_timeout(50)
        r=page.evaluate('''() => {const root=document.documentElement,body=getComputedStyle(document.body),m=new DOMMatrix(body.transform),sx=Math.hypot(m.a,m.b),sy=Math.hypot(m.c,m.d),hp=getComputedStyle(document.querySelector('.gl-hp-overlay'));return {className:root.className,scaleX:sx,scaleY:sy,phase:parseFloat(getComputedStyle(document.querySelector('.phase')).height),logicalW:root.style.getPropertyValue('--gl-stage-logical-w'),logicalH:root.style.getPropertyValue('--gl-stage-logical-h'),hpW:hp.width,hpH:hp.height,heroUIScale:root.style.getPropertyValue('--gl-hero-ui-scale')}}''')
        r.update({'w':w,'h':h,'mobile':mobile,'pageErrors':errors})
        assert not errors,(w,h,errors)
        if mobile:
            assert 'gl-pvp-mobile-gameplay' in r['className'],(w,h,r)
            assert abs(r['scaleX']-r['scaleY'])<1e-5,(w,h,r)
            assert abs(r['phase']-46.8)<.2,(w,h,r)
            assert float(r['heroUIScale'])>=1,(w,h,r)
            assert r['hpW']!='auto' and r['hpH']!='auto',(w,h,r)
        else:assert 'gl-adaptive-stage' not in r['className']
        rows.append(r)
        ctx.close()
    browser.close()
print('PASS latest UI stage synthetic: 6 touch viewports (uniform scale, phase, HP size), 1 desktop unchanged')
Path(__file__).resolve().parents[1].joinpath('docs','VS_AI_UI_FOLLOWUP_STAGE_SYNTHETIC_RESULTS.json').write_text(json.dumps(rows,indent=2))
