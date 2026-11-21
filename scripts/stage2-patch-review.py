from pathlib import Path
p=Path(__file__).resolve().parents[1]
runtime=p/'public/battle/shared-app/app-runtime.js'
s=runtime.read_text()
old="cardReviewOverlay.innerHTML='<section class=\"gl-card-review-panel\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Card Review\"><div class=\"gl-card-review-body\"></div></section>';"
new="cardReviewOverlay.innerHTML='<section class=\"gl-card-review-panel\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Card Review\"><button class=\"gl-card-review-outer-close gl-card-review-close\" type=\"button\" aria-label=\"Close Card Review\">CLOSE</button><div class=\"gl-card-review-body\"></div></section>';"
assert s.count(old)==1
s=s.replace(old,new)
# Do not hide the already-useable iframe or add a Back-of-Card blocking overlay.
old="  body.classList.remove('gl-review-ready');\n  body.dataset.glReviewKey=key;"
new="  body.dataset.glReviewKey=key;\n  // Show the modal immediately; the iframe's loading/decoding is non-blocking.\n  let pendingFace=body.querySelector('.gl-review-loading-art');\n  if(!pendingFace){pendingFace=document.createElement('img');pendingFace.className='gl-review-loading-art';pendingFace.alt='Card artwork';body.prepend(pendingFace);}\n  pendingFace.src=window.GL_PVP_ARTWORK?.thumb?.(cardId)||art(cardId);\n  pendingFace.hidden=!!(previous?.contentWindow?.GL_S0_REVIEW_RENDER);"
assert s.count(old)==1
s=s.replace(old,new)
# In the first render, append a preview image to avoid showing an empty frame.
needle="  cardReviewOverlay.classList.add('open');\n  clearTimeout(openCardReview.fallbackTimer);\n  openCardReview.fallbackTimer=setTimeout(()=>{"
repl="  cardReviewOverlay.classList.add('open');\n  clearTimeout(openCardReview.fallbackTimer);\n  openCardReview.fallbackTimer=setTimeout(()=>{"
assert s.count(needle)==1
# Keep fallback but don't hide functioning frame just because fonts/high-res art took time.
s=s.replace("    const frame=body.querySelector('.gl-db158-review-frame');\n    // An unavailable stylesheet/script is a presentation failure, not a reason\n    // to trap the player. Show a readable card image and keep CLOSE usable.\n    if(frame){frame.style.display='none';}","    const frame=body.querySelector('.gl-db158-review-frame');\n    // A slow artwork decode is not a failed Card Review. Fall back only if\n    // the iframe renderer itself never initialized. The outer CLOSE stays live.\n    if(frame?.contentWindow?.GL_S0_REVIEW_RENDER){body.classList.add('gl-review-ready');return;}\n    if(frame){frame.style.display='none';}")
s=s.replace("    image.src=art(cardId);image.alt=cv(cardId)?.name||cardId;","    image.src=window.GL_PVP_ARTWORK?.thumb?.(cardId)||art(cardId);image.alt=cv(cardId)?.name||cardId;")
s=s.replace("function closeCardReview(){\n  cardReviewOverlay.classList.remove('open');","function closeCardReview(){\n  clearTimeout(openCardReview.fallbackTimer);\n  cardReviewOverlay.classList.remove('open');")
runtime.write_text(s)
review=p/'public/battle/shared-app/db158-card-review.js'
s=review.read_text()
start=s.index('  var files=[')
end=s.index(';',start)+1
s=s[:start]+"  var files=['pvp-review-bundle-rc40-20261116.css'];"+s[end:]
s=s.replace("    body.classList.remove('gl-review-ready');\n    w.GL_S0_REVIEW_RENDER(c);","    w.GL_S0_REVIEW_RENDER(c);\n    // Instant source-compatible exact-card image; full art upgrades in place.\n    var reviewArt=d.getElementById('reviewArt');\n    g.GL_PVP_ARTWORK?.bind?.(reviewArt,{cardId:c.id,src:c.image,priority:'review'});\n    body.querySelector('.gl-review-loading-art')?.setAttribute('hidden','');\n    body.classList.add('gl-review-ready');")
# Keep fit calculation but never block visibility on image load or fonts.
start=s.index('    // Show the review once the artwork is decoded;')
end=s.index('    return true;',start)
s=s[:start]+'''    // Height adjustment may happen asynchronously; visible content and CLOSE
    // must not depend on decode, font readiness, or an iframe READY message.
    w.requestAnimationFrame(function(){
      if(!frame.isConnected||frame.__glReviewRequest!==request)return;
      ready();
    });
''' +s[end:]
# Child bootstrap uses same thumbnail technique for the very first iframe render.
s=s.replace('window.GL_S0_REVIEW_RENDER(card);if(lineage.length)',
            'window.GL_S0_REVIEW_RENDER(card);parent.GL_PVP_ARTWORK?.bind?.(document.getElementById("reviewArt"),{cardId:card.id,src:card.image,priority:"review"});if(lineage.length)')
review.write_text(s)
css=p/'public/battle/shared-ui/battlefield-ui.css'
s=css.read_text()
start=s.index('/* Hide iframe until first layout, stylesheet, font and artwork are ready;')
end=s.index('/* F15 Hand-aware search presentation',start)
s=s[:start]+'''/* Stage 2 Card Review: instant interactive shell, one reusable iframe.
 * A high-resolution image/font stall must not hide review text or CLOSE. */
.gl-card-review-panel{position:relative!important}
.gl-card-review-body{position:relative!important;min-height:min(530px,75vh)!important;}
.gl-card-review-body .gl-db158-review-frame{visibility:visible!important;opacity:1!important;transition:none!important;position:relative;z-index:1}
.gl-card-review-body.gl-review-ready{min-height:0!important}
.gl-card-review-body::after{content:none!important}
.gl-review-loading-art{position:absolute;inset:10px 0 auto;margin:auto;max-width:min(280px,75vw);max-height:72vh;object-fit:contain;border-radius:8px;pointer-events:none;z-index:0}
.gl-review-loading-art[hidden]{display:none!important}
.gl-card-review-outer-close{position:absolute;right:9px;top:8px;z-index:30;border:1px solid #a68d58;border-radius:8px;padding:6px 12px;cursor:pointer;background:#121c2a;color:#fff;font-weight:800;box-shadow:0 2px 15px #0008}
.gl-card-review-body:has(.gl-review-emergency-art) .gl-db158-review-frame{display:none!important}
.gl-review-emergency-art{display:block;position:relative;z-index:2;width:min(350px,80vw);max-height:75vh;object-fit:contain;margin:15px auto;border-radius:9px}
.gl-review-emergency-close{display:block!important;position:absolute;right:12px;top:12px;z-index:5;cursor:pointer}

''' +s[end:]
css.write_text(s)
print('Patched Card Review: bundled CSS, immediate modal, persistent iframe, independent close')
