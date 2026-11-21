from pathlib import Path
p=Path(__file__).resolve().parents[1]
runtime=p/'public/battle/shared-app/app-runtime.js'
s=runtime.read_text()
start=s.index('// RC40 Patch 3.2: VS AI draws the local player')
end=s.index('function shardArt(sh)',start)
s=s[:start]+'''// The own Hand face is known only after a viewer-safe reveal. Immediately
// assign its exact-card embedded thumbnail and load full resolution in the
// background; never cover a revealed face with a Back-of-Card preload guard.
function glBindPlayerHandArtwork(card,img,id){
  const cardId=String(id||'');
  const fallback='assets/ui/'+(cardId.startsWith('S0-MAN-')?'back-shard.webp':(/-[HL]\\d+$/i.test(cardId)?'back-legacy.webp':'back-main.webp'));
  img.decoding='async';
  img.addEventListener('error',()=>{
    if(img.dataset.glHandArtFallback==='1')return;
    if(img.dataset.glPvpArtStage==='thumb')return;
    try{if(new URL(img.src,document.baseURI).href===new URL(fallback,document.baseURI).href)return;}catch{}
    img.dataset.glHandArtFallback='1';
    img.src=window.GL_PVP_ARTWORK?.thumb?.(cardId)||fallback;
  });
  if(!window.GL_PVP_ARTWORK?.bind?.(img,{cardId,src:art(cardId),priority:'hand'})){
    // A missing thumbnail is a build error, never a reason to hide own cards.
    if(!img.getAttribute('src'))img.src=art(cardId)||fallback;
  }
}

''' +s[end:]
start=s.index('// PvP-only, privacy-safe artwork warmup.')
end=s.index('function glPvpWarmVisibleArtwork(state)',start)
s=s[:start]+'''// The shared full-art queue is owned by pvp-artwork-loader.js. This small
// compatibility adapter preserves Hero / Attachment warmups without creating
// a second loader or caching failed requests indefinitely.
function glPvpPreloadArtwork(src){
  return window.GL_PVP_ARTWORK?.load?.(src,{priority:'public'})||Promise.resolve(false);
}
function glPvpGuardHandFace(card,img,id){
  if(!img)return;
  // Clear classes left by old releases. They drew a Back-of-Card *over* a
  // successfully decoded own-Hand face whenever a separate preload failed.
  card.classList.remove('gl-hand-art-awaiting','gl-hand-art-unavailable');
  window.GL_PVP_ARTWORK?.bind?.(img,{cardId:String(id),src:art(id),priority:'hand'});
}
''' +s[end:]
s=s.replace("    const artworkPending=!!existing?.classList.contains('gl-hand-art-awaiting');\n",'')
s=s.replace("    if(artworkPending)card.classList.add('gl-hand-art-awaiting');\n",'')
runtime.write_text(s)
# Put generated thumbnails and loader before the UI runtime, without disturbing
# the PvP network / authority / animation script ordering.
html=p/'public/battle/index.html'
s=html.read_text()
needle='  <script src="shared-app/app-runtime.js?'
assert s.count(needle)==1
s=s.replace(needle,'  <script src="runtime/pvp-card-thumbnails.js"></script>\n  <script src="runtime/pvp-artwork-loader.js"></script>\n'+needle)
html.write_text(s)
# Disable only the obsolete own-Hand back overlay. Hidden opponent Hand and
# unrevealed Draw reservations retain their dedicated Back-of-Card visuals.
css=p/'public/battle/runtime/pvp-mobile-landscape-fix.css'
s=css.read_text()
start=s.index('/* The already-loaded card back remains visible until the local hand face')
end=s.index('}',start)+1
s=s[:start]+'''/* Revealed own-Hand faces must never be covered by the old preload mask.
 * Hidden opponent cards and unrevealed Draw slots are unaffected. */
.hand.bottom .hand-card.gl-hand-art-awaiting::before,
.hand.bottom .hand-card.gl-hand-art-unavailable::before{content:none!important;}
'''+s[end:]
css.write_text(s)
print('Patched stage2 Hand renderer, loaded thumbnail bundle, removed obsolete blocking overlay')
