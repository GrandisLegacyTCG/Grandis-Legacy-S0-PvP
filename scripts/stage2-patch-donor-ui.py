from pathlib import Path
p=Path(__file__).resolve().parents[1]
engine=p/'public/battle/engine/shared-app/app.bundle.js'
s=engine.read_text()
old="      if(isAttackCard(c)){\n        if(!(h && h.hp>0) || isLegacyModeHero(h)) return false;"
new="""      if(isAttackCard(c)){
        // Donor-approved rule: Casting locks an opposing POSITION, not a Hero.
        // A Legacy occupying the position is legal at declaration. On release
        // the engine still checks the occupant before dealing damage.
        if(isCastingCard(c)) return true;
        if(!(h && h.hp>0) || isLegacyModeHero(h)) return false;"""
assert s.count(old)==1
s=s.replace(old,new)
old="if(targetSide===oppositeSide(side) && isAttackCard(c) && !attackActsAsAreaForSource(state,c,sourceHero)) legal=applyTauntTargeting(state,targetSide,legal);"
new="if(targetSide===oppositeSide(side) && isAttackCard(c) && !isCastingCard(c) && !attackActsAsAreaForSource(state,c,sourceHero)) legal=applyTauntTargeting(state,targetSide,legal);"
assert s.count(old)==1
s=s.replace(old,new)
engine.write_text(s)
# Port the donor's stable-selection SESSION idea, never its object-identity test.
# The key deliberately excludes selected indices so WebSocket ACK cannot reset
# the scroll position while the same pending card search continues.
runtime=p/'public/battle/shared-app/app-runtime.js'
s=runtime.read_text()
start=s.index("let glHandSearchPendingKey='';")
end=s.index("function positionReturnToHandSearch(){",start)
s=s[:start]+'''let glHandSearchSessionKey='';
let glSwapNoticeSeen=0,glSwapNoticeGameRef='';
function returnToHandSearchSessionKey(s,p){
  if(!p)return '';
  return JSON.stringify({
    epoch:glPresentationEpoch,round:s?.round||0,turn:s?.turn||'',phase:s?.phase||'',
    zone:candidateSourceZone(p),source:p.source_card_id||'',
    token:p.choice_id||p.commit_token||'',resolve_to:p.resolve_to||'',
    title:p.title||'',instruction:p.instruction||'',
    candidates:(p.candidates||[]).map(c=>typeof c==='string'?c:
      [c.card_id||'',c.deck_index??c.discard_index??c.hand_index??-1])
  });
}
function resetReturnToHandSearchDisplay(){
  glHandSearchSessionKey='';
  choiceOverlay.classList.remove('gl-choice-to-hand');
  document.body.classList.remove('gl-choice-to-hand-active');
}
''' +s[end:]
old='''  const pendingKey=handSearch?String(p.choice_id||p.commit_token||''):'';
  const gridBefore=choiceOverlay.querySelector('.gl-choice-body .card-search-choice-grid');
  const sameSearch=handSearch&&pendingKey&&pendingKey===glHandSearchPendingKey;
  const scrollBefore=sameSearch&&gridBefore?Math.max(0,gridBefore.scrollTop):0;
  glHandSearchPendingKey=handSearch?pendingKey:'';'''
new='''  const searchSessionKey=handSearch?returnToHandSearchSessionKey(s,p):'';
  const gridBefore=choiceOverlay.querySelector('.gl-choice-body .card-search-choice-grid');
  const scrollBefore=handSearch&&searchSessionKey===glHandSearchSessionKey&&gridBefore?
    Math.max(0,gridBefore.scrollTop):0;
  glHandSearchSessionKey=searchSessionKey;'''
assert s.count(old)==1
s=s.replace(old,new)
s=s.replace('if(glHandSearchPendingKey===pendingKey&&grid.isConnected', 'if(glHandSearchSessionKey===searchSessionKey&&grid.isConnected')
# Hero preview is presentation only; p.swap_options is authoritative. A
# pending option must never become unselectable based on guessed client rules.
start=s.index('  if(swapChoice){\n    choiceOverlay.classList.remove',s.index('function renderAllowedModal(s){'))
end=s.index('  confirm.hidden=false;',start)
s=s[:start]+'''  if(swapChoice){
    choiceOverlay.classList.remove('gl-choice-main-deck-preview');
    const from=p.source_lane,heroes=sideHeroes(s,p.source_side)||{};
    const available=new Set((p.swap_options?.length)?p.swap_options:(p.swap_lane?[p.swap_lane]:[]));
    let destinations=laneOrder.filter(l=>l!==from);
    if(from==='LEFT'&&available.size===1&&available.has('CENTER'))destinations=['LEFT','CENTER'];
    if(from==='RIGHT'&&available.size===1&&available.has('CENTER'))destinations=['CENTER','RIGHT'];
    if(from==='RIGHT'&&available.size===1&&available.has('LEFT'))destinations=['LEFT','RIGHT'];
    if(from==='LEFT'&&available.size===1&&available.has('RIGHT'))destinations=['LEFT','RIGHT'];
    title.textContent='Swap — Choose Position';
    body.replaceChildren();body.classList.remove('gl-choice-body-main-deck');
    const desc=document.createElement('p');desc.className='choice-instruction';
    desc.textContent=(cv(p.card_id)?.name||'This card')+': choose a legal Hero or Legacy to Swap with, or SKIP.';
    const row=document.createElement('div');row.className='gl-swap-choice-actions';
    function swapSlot(lane,isSource){
      const box=document.createElement('div');box.className='gl-swap-choice-slot';
      const actual=isSource?from:lane,h=heroes[actual],id=heroImageId(h);
      const permitted=isSource||available.has(lane);
      if(!permitted)box.classList.add('is-disabled');
      if(isSource)box.classList.add('is-source');
      if(!isSource&&lane===from)box.classList.add('is-self-position');
      const role=document.createElement('div');role.className='gl-swap-choice-role';
      role.textContent=isSource?'YOUR HERO · '+from:lane;
      const frame=document.createElement('div');frame.className='gl-swap-choice-frame';
      if(!isSource&&lane===from){
        const back=document.createElement('img');back.src='assets/ui/back-legacy.webp';
        back.alt='Current position is not selectable';frame.appendChild(back);
      }else if(id){
        const img=document.createElement('img');img.src=window.GL_PVP_ARTWORK?.thumb?.(id)||art(id);
        img.alt=(cv(id)?.name||id)+' at '+actual;frame.appendChild(img);
        window.GL_PVP_ARTWORK?.bind?.(img,{cardId:id,src:art(id),priority:'public'});
      }else{frame.classList.add('is-empty');const blank=document.createElement('span');blank.textContent='—';frame.appendChild(blank);}
      const name=document.createElement('div');name.className='gl-swap-choice-name';
      name.textContent=id?(cv(id)?.name||id):'Unavailable';
      const button=document.createElement('button');button.type='button';
      button.className='gl-swap-choice-button'+(isSource?' gl-swap-choice-skip':'');
      button.textContent=isSource?'SKIP':'SWAP TO '+lane;
      button.disabled=!permitted;button.title=permitted?(isSource?'Do not Swap':'Swap to '+lane):'Not in server legal Swap options';
      if(permitted)button.onclick=()=>intent('performOptionalSwapDecision',[isSource?false:lane]);
      box.append(role,frame,name,button);return box;
    }
    row.appendChild(swapSlot(destinations[0]||'LEFT',false));
    row.appendChild(swapSlot(from,true));
    row.appendChild(swapSlot(destinations[1]||'RIGHT',false));
    body.append(desc,row);
    if(cancel){cancel.hidden=true;cancel.onclick=null;}
    confirm.hidden=true;confirm.disabled=true;
    return;
  }
''' +s[end:]
# Refresh the optional Swap preview when the server changes visible Heroes.
old='''  const candidateZone=candidateSourceZone(p),modalSig=JSON.stringify({type:p.type,'''
new='''  const candidateZone=candidateSourceZone(p),swapHeroSig=p.type==='optional_swap'?
    laneOrder.map(l=>{const h=sideHeroes(s,p.source_side)?.[l];return [l,heroImageId(h)||'',Number(h?.hp||0),!!h?.legacy_mode,(h?.statuses||[]).map(x=>[x.name,x.duration])];}):null,
    modalSig=JSON.stringify({type:p.type,'''
assert s.count(old)==1
s=s.replace(old,new)
s=s.replace("swap_options:p.swap_options||[],swap_card:p.card_id||''});","swap_options:p.swap_options||[],swap_card:p.card_id||'',swap_hero_state:swapHeroSig});")
runtime.write_text(s)
# Import only the matching donor *styles* for preview cards, not the donor
# network/authority renderer or its optional-target decision logic.
donor=Path('/mnt/data/_audit_rc42/vs42/shared-ui/battlefield-ui.css').read_text()
start=donor.index('.gl-vsai-choice-overlay.gl-choice-swap .gl-swap-choice-slot{')
end=donor.index('}',donor.index('.gl-vsai-choice-overlay.gl-choice-swap .gl-swap-choice-slot.is-self-position .gl-swap-choice-frame.is-legacy-back img{',start))+1
style=donor[start:end]
css=p/'public/battle/shared-ui/battlefield-ui.css'
css.write_text(css.read_text()+'\n/* Stage 2: donor-inspired visual-only Hero/Legacy preview for optional Swap. */\n'+style+'\n')
print('Patched donor Casting position rule, stable search scroll and server-owned Swap previews')
