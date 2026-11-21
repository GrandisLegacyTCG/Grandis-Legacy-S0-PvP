  function glPvpSwapKeys(state){
    if(!state) return state;
    var s=glPvpDeepSwapSides(clone(state));
    function sw(a,b){ var t=s[a]; s[a]=s[b]; s[b]=t; }
    sw('mana','aiMana'); sw('manaRegen','aiManaRegen'); sw('racial','aiRacial');
    sw('playerManaPoolCards','aiManaPoolCards'); sw('playerManaDeck','aiManaDeck');
    sw('playerManaClasses','aiManaClasses'); sw('playerManaDeckCount','aiManaDeckCount');
    sw('playerDeck','aiDeck'); sw('playerHand','aiHand'); sw('playerDiscard','aiDiscard');
    sw('playerHeroes','aiHeroes'); sw('playerLegacy','aiLegacy');
    sw('playerLegacyPackageSlots','aiLegacyPackageSlots'); sw('playerDeckName','aiDeckName');
    sw('playerDeckCount','aiDeckCount'); sw('playerLegacyCount','aiLegacyCount');
    // Side string values were already swapped by glPvpDeepSwapSides; do not double-swap turn/winner.
    function swapSideMapKeys(map){ if(!map || typeof map!=='object') return; var __v=map.PLAYER; map.PLAYER=map.AI; map.AI=__v; }
    swapSideMapKeys(s.pvpPlayerNames);
    swapSideMapKeys(s.pvpActionEventsBySide);
    swapSideMapKeys(s.manualRepositionUsedTurnKey);
    if(s.manualRepositionUsedTurnKey){Object.keys(s.manualRepositionUsedTurnKey).forEach(function(side){var key=s.manualRepositionUsedTurnKey[side];if(typeof key==='string')s.manualRepositionUsedTurnKey[side]=key.replace(/\|(PLAYER|AI)$/g,function(_,v){return '|'+glPvpSwapExactSide(v);});});}
    swapSideMapKeys(s.cardsDrawnThisTurn);
    swapSideMapKeys(s.lastDrawnCardBySide);
    // PvP RC41: seat-2 snapshots mirror PLAYER/AI, including turn-stamped
    // map KEYS. The donor originally flipped only side VALUES, which made
    // Provoke fire twice after an opponent resolves the pending Mana choice.
    function swapStampKeys(map){
      if(!map||typeof map!=='object'||Array.isArray(map))return map;
      var out={};Object.keys(map).forEach(function(key){
        var replaced=key.replace(/(^|:)(PLAYER|AI)(?=:|$)/g,function(_,prefix,side){return prefix+glPvpSwapExactSide(side);});
        out[replaced]=map[key];
      });return out;
    }
    s.s0_provoke_processed_turns=swapStampKeys(s.s0_provoke_processed_turns);
    s.s0_attack_cards_played_by_turn=swapStampKeys(s.s0_attack_cards_played_by_turn);
    s.s0BardDrawResolved=swapStampKeys(s.s0BardDrawResolved);
    if(s.endPhaseCleanupProgress&&typeof s.endPhaseCleanupProgress.key==='string')
      s.endPhaseCleanupProgress.key=s.endPhaseCleanupProgress.key.replace(/(^|:)(PLAYER|AI)(?=:|$)/g,function(_,prefix,side){return prefix+glPvpSwapExactSide(side);});
    // glPvpDeepSwapSides has already mirrored presentation event sides.
    if(Array.isArray(s.log)) s.log=s.log.map(glPvpSwapTextSide);
    // lastOpponentAction was also mirrored by glPvpDeepSwapSides above.
    return s;
  }
