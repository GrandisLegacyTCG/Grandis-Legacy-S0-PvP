  function localManaLossShardSummary(shards){
    var tally={};(shards||[]).forEach(function(sh){
      if(!sh)return;var name=sh.kind==='CLASS'?(String(sh.class_name||'Color')+' Color'):'Regular';
      tally[name]=(tally[name]||0)+1;
    });
    return Object.keys(tally).map(function(name){return name+' x'+tally[name];}).join(', ');
  }
  // The donor's DOM toast never executes inside PvP's headless authority.
  // Publish an immutable, POST-resolution notice from the authoritative state.
  // The recipient projection only passes their own loss, without physical UIDs.
  function commitPvpManaLossNotice(state,targetSide,sourceSide,effectName,removedShards,sourceInfo){
    var list=(removedShards||[]).filter(Boolean);
    if(!state||!state.pvpHumanVsHuman||!list.length)return false;
    state.presentationEvents=Array.isArray(state.presentationEvents)?state.presentationEvents:[];
    state.presentationEventSequence=Number(state.presentationEventSequence||0)+1;
    state.presentationEvents.push({
      id:'MANA-LOSS-'+state.presentationEventSequence,type:'MANA_LOSS_COMMITTED',
      side:targetSide,source_side:sourceSide,effect_name:String(effectName||'Ability').slice(0,100),
      effect_card_id:sourceInfo&&/^S0-[A-Z0-9]+-[A-Z0-9]+$/.test(String(sourceInfo.card_id||''))?String(sourceInfo.card_id):null,
      effect_action_id:sourceInfo&&/^pvp_(PLAYER|AI)_/.test(String(sourceInfo.action_id||''))?String(sourceInfo.action_id):null,
      removed_count:list.length,shard_details:localManaLossShardSummary(list),
      loss_kind:sourceSide===targetSide?'ABILITY_SPEND':'OPPONENT_REMOVE',
      removed_shards:list.map(function(sh){return {kind:sh.kind==='CLASS'?'CLASS':'MANA',
        class_name:sh.kind==='CLASS'?String(sh.class_name||''):''};}),
      sequence:state.presentationEventSequence
    });
    if(state.presentationEvents.length>160)state.presentationEvents=state.presentationEvents.slice(-160);
    return true;
  }
  function notifyLocalManaLoss(state,targetSide,sourceSide,effectName,removedShards,sourceInfo){
    // PvP bridge: preserve the recipient-only committed event contract from
    // RC40. The RC41 VS AI donor does not need to change its local behavior.
    if(state&&state.pvpHumanVsHuman)
      return commitPvpManaLossNotice(state,targetSide,sourceSide,effectName,removedShards,sourceInfo);
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
