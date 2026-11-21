  function notifyLocalManaLoss(state,targetSide,sourceSide,effectName,removedShards){
    var list=(removedShards||[]).filter(Boolean);
    if(!state||targetSide!=='PLAYER'||!list.length)return false;
    state.presentationEvents=Array.isArray(state.presentationEvents)?state.presentationEvents:[];
    state.presentationEventSequence=Number(state.presentationEventSequence||0)+1;
    state.presentationEvents.push({
      id:'MANA-LOSS-'+state.presentationEventSequence,
      type:'MANA_LOSS_RESOLVED',side:'PLAYER',source_side:sourceSide,
      effect_name:String(effectName||'Ability'),
      loss_kind:sourceSide==='PLAYER'?'ABILITY_SPEND':'OPPONENT_REMOVE',
      removed_count:list.length,
      removed_shards:list.map(function(sh){return {kind:sh.kind==='CLASS'?'CLASS':'MANA',class_name:sh.kind==='CLASS'?String(sh.class_name||''):''};})
    });
    if(state.presentationEvents.length>160)state.presentationEvents=state.presentationEvents.slice(-160);
    return true;
  }
