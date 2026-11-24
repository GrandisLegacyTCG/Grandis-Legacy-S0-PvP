from playwright.sync_api import sync_playwright
from pathlib import Path
import re,json,math
root=Path('/mnt/data/GL_PvP_Step2_Work_20261124/public/battle')
html=(root/'index.html').read_text()
css0=re.search(r'<style>(.*?)</style>',html,re.S).group(1)
responsive_css=re.search(r'<style id="gl-responsive-stage">(.*?)</style>',html,re.S).group(1)
js0=re.search(r'<script id="gl-responsive-stage-js">(.*?)</script>',html,re.S).group(1)
csses=[root/'shared-ui/battlefield-ui.css',root/'runtime/pvp-mobile-landscape-fix.css',root/'runtime/pvp-mobile-all5.css',root/'runtime/pvp-mobile-followup.css',root/'runtime/pvp-mobile-vsai-batch2-parity.css']
res=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    for w,h in [(390,844),(844,390),(360,700)]:
        c=browser.new_context(viewport={'width':w,'height':h},is_mobile=True,has_touch=True)
        page=c.new_page()
        page.set_content('''<html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div class="app"><main class="battlefield"><div class="opponent-field"></div><div class="phase"></div><div class="player-field"></div><div class="bottom-hud"></div></main><aside class="sidebar"></aside></div><div class="gl-center-choice-stage open gl-center-mode-pay" data-gl-action-popup="0"><div class="gl-center-choice-copy"><h2>PAY MANA</h2></div><div class="gl-center-choice-cards"></div><div class="gl-center-choice-actions"></div></div></body></html>''')
        page.add_style_tag(content=css0)
        page.add_style_tag(content=responsive_css)
        for f in csses:page.add_style_tag(content=f.read_text())
        page.evaluate(js0)
        page.wait_for_timeout(80)
        page.evaluate('''() => {document.documentElement.classList.add('gl-pvp-mobile-gameplay');document.body.classList.add('gl-center-choice-active','gl-center-pay');}''')
        for mode,num in [('pay',12),('action',8),('return_exp',8),('pay',1)]:
            data=page.evaluate('''({mode,count}) => {
                const stage=document.querySelector('.gl-center-choice-stage');
                const host=stage.querySelector('.gl-center-choice-cards');
                const body=document.body;
                body.classList.toggle('gl-center-pay',mode==='pay');body.classList.toggle('gl-center-discard',mode==='return_exp');
                stage.dataset.glActionPopup=mode==='return_exp'?'1':'0';
                stage.className='gl-center-choice-stage open gl-center-mode-'+mode;
                host.style.setProperty('--gl-choice-count',String(count));
                host.innerHTML=Array.from({length:count},(_,i)=>'<button class="gl-center-choice-card is-face-up"><span class="gl-center-choice-flip"><span class="gl-center-choice-face gl-center-choice-front"><img width="100" height="140" alt="Card" /></span></span></button>').join('');
                const kids=[...host.children];
                const hero=document.createElement('div');hero.style.cssText='position:absolute;pointer-events:none;visibility:hidden;width:var(--hero-w);height:1px';document.body.appendChild(hero);
                const heroWidthPx=parseFloat(getComputedStyle(hero).width);hero.remove();
                const cs=getComputedStyle(host),els=kids.map(el=>getComputedStyle(el));
                return {mode,count,hostW:host.clientWidth,hostScrollW:host.scrollWidth,
                    childW:kids[0].offsetWidth,childH:kids[0].offsetHeight,
                    flexWrap:cs.flexWrap,overflowX:cs.overflowX,childAspect:els[0].aspectRatio,
                    childWidths:kids.map(x=>x.offsetWidth),gap:cs.columnGap, widthCss:els[0].width, flexBasis:els[0].flexBasis, minWidth:els[0].minWidth, maxWidth:els[0].maxWidth, heroWidthPx,heroVar:getComputedStyle(document.documentElement).getPropertyValue('--hero-w'), heroBase:getComputedStyle(document.documentElement).getPropertyValue('--hero-base-w')};
            }''',{'mode':mode,'count':num})
            assert data['childW']>0,(w,h,mode,data)
            if mode in ['pay','action','return_exp'] and num>=8:
                assert data['hostScrollW']<=data['hostW']+3,(w,h,mode,data)
                assert data['flexWrap']=='nowrap',(w,h,mode,data)
            # 8-card direct actions/Return EXP must be 85% of the real hero
            # (not the stale physical viewport base width from pre-RC42 PvP).
            if mode in ('action','return_exp') and num==8:
                assert abs(data['childW'] - data['heroWidthPx']*.85)<2.5,(w,h,mode,data)
            if num>=8:
                assert data['hostScrollW']<=data['hostW']+3,(w,h,mode,data)
            res.append({'viewport':[w,h],**data})
            print('PASS',w,h,mode,num,'host',data['hostW'],'scroll',data['hostScrollW'],'cards',data['childW'],'flex',data['flexWrap'],'heroVar',data['heroVar'],'widthCss',data['widthCss'],'flexBasis',data['flexBasis'])
        c.close()
    browser.close()
Path('/mnt/data/GL_PvP_Step2_Work_20261124/docs/step2/qa_mobile_choices_results.json').write_text(json.dumps(res,indent=2))
