  function glPvpSwapKeys(state){
    if(!state) return state;
    var s=glPvpDeepSwapSides(clone(state));
    function sw(a,b){ var t=s[a]; s[a]=s[b]; s[b]=t; }
    sw('mana','aiMana'); sw('manaRegen','aiManaRegen'); sw('racial','aiRacial');
    sw('playerDeck','aiDeck'); sw('playerHand','aiHand'); sw('playerDiscard','aiDiscard');
    sw('playerHeroes','aiHeroes'); sw('playerLegacy','aiLegacy');
    sw('playerLegacyPackageSlots','aiLegacyPackageSlots'); sw('playerDeckName','aiDeckName');
    sw('playerDeckCount','aiDeckCount'); sw('playerLegacyCount','aiLegacyCount');
    // Side string values were already swapped by glPvpDeepSwapSides; do not double-swap turn/winner.
    function swapSideMapKeys(map){ if(!map || typeof map!=='object') return; var __v=map.PLAYER; map.PLAYER=map.AI; map.AI=__v; }
    swapSideMapKeys(s.pvpPlayerNames);
    swapSideMapKeys(s.pvpActionEventsBySide);
    swapSideMapKeys(s.cardsDrawnThisTurn);
    swapSideMapKeys(s.lastDrawnCardBySide);
    if(Array.isArray(s.presentationEvents))s.presentationEvents=s.presentationEvents.map(function(e){var x=clone(e);x.side=glPvpSwapExactSide(x.side);return x;});
    if(Array.isArray(s.log)) s.log=s.log.map(glPvpSwapTextSide);
    if(s.lastOpponentAction){ s.lastOpponentAction=glPvpDeepSwapSides(s.lastOpponentAction); }
    return s;
  }
