from playwright.sync_api import sync_playwright
from pathlib import Path
import re,json
root=Path('/mnt/data/GL_PvP_Step2_Work_20261124/public/battle')
html=(root/'index.html').read_text()
inline_css=re.search(r'<style>(.*?)</style>',html,re.S).group(1)
responsive_css=re.search(r'<style id="gl-responsive-stage">(.*?)</style>',html,re.S).group(1)
stage_js=re.search(r'<script id="gl-responsive-stage-js">(.*?)</script>',html,re.S).group(1)
css_files=[root/'shared-ui/battlefield-ui.css',root/'runtime/pvp-mobile-landscape-fix.css',root/'runtime/pvp-mobile-all5.css',root/'runtime/pvp-mobile-followup.css',root/'runtime/pvp-mobile-vsai-batch2-parity.css']
results=[]
with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  for w,h,touch in [(390,844,True),(844,390,True),(360,700,True),(1180,820,True),(1280,600,True),(1440,900,False)]:
    ctx=browser.new_context(viewport={'width':w,'height':h},is_mobile=touch,has_touch=touch,device_scale_factor=1)
    page=ctx.new_page()
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.set_content('''<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>STEP2 synthetic</title></head><body>
      <div class="app"><main class="battlefield"><section class="opponent-field"><div class="hero-lane"><div class="hero-card"></div></div></section>
      <section class="phase"><div class="phase-track"><span class="phase-label active">Battle</span></div></section><section class="player-field"><div class="hero-lane"><div class="hero-card"></div></div></section>
      <section class="bottom-hud"><section class="hand bottom"><div class="hand-track"></div></section></section></main>
      <aside class="sidebar"><div class="played-box"></div></aside></div></body></html>''')
    page.add_style_tag(content=inline_css)
    page.add_style_tag(content=responsive_css)
    for css in css_files:page.add_style_tag(content=css.read_text())
    page.evaluate(stage_js)
    page.wait_for_timeout(140)
    if touch:
      page.evaluate("document.documentElement.classList.add('gl-pvp-mobile-gameplay')")
      page.wait_for_timeout(140)
    data=page.evaluate('''() => {
      const html=document.documentElement,body=document.body;
      const m=new DOMMatrix(getComputedStyle(body).transform);
      const sx=Math.hypot(m.a,m.b),sy=Math.hypot(m.c,m.d);
      const el=document.querySelector('.app'),ph=document.querySelector('.phase');
      return {stage:html.className,bodyTransform:getComputedStyle(body).transform,
        sx,sy,ratio:sy>0?sx/sy:0,phase:parseFloat(getComputedStyle(ph).height),
        logicalW:html.style.getPropertyValue('--gl-stage-logical-w'),
        logicalH:html.style.getPropertyValue('--gl-stage-logical-h'),
        appW:getComputedStyle(el).width,appH:getComputedStyle(el).height,
        heroW:html.style.getPropertyValue('--hero-base-w-logical')}
    }''')
    results.append({'width':w,'height':h,'touch':touch,**data,'errors':errors})
    if touch:
      assert abs(data['ratio']-1)<1e-5,(w,h,data)
      assert abs(data['phase']-46.8)<.11,(w,h,data)
      assert 'gl-pvp-mobile-gameplay' in data['stage']
      assert not errors,(w,h,errors)
      print('PASS touch',w,h,'scale',round(data['sx'],4),'ratio',round(data['ratio'],7),'phase',data['phase'],'stageW/H',data['appW'],data['appH'])
    else:
      assert 'gl-adaptive-stage' not in data['stage'],data
      assert not errors,errors
      print('PASS desktop',w,h,'desktop layout untouched')
    ctx.close()
  browser.close()
Path('/mnt/data/GL_PvP_Step2_Work_20261124/docs/step2/qa_mobile_synthetic_results.json').write_text(json.dumps(results,indent=2))
