  function recordPublicSelectedPickup(state,side,cardId,sourceZone,sourceCardId,handIndex){
    if(!state||!cardId||['Main Deck','Discard'].indexOf(sourceZone)===-1)return;
    state.presentationEvents=Array.isArray(state.presentationEvents)?state.presentationEvents:[];
    state.presentationEventSequence=Number(state.presentationEventSequence||0)+1;
    state.presentationEvents.push({id:'PICKUP-'+state.presentationEventSequence,
      type:'CARD_PUBLIC_PICKUP',side:side,card_id:cardId,from_zone:sourceZone,
      source_card_id:sourceCardId||null,hand_index:Number(handIndex),
      sequence:state.presentationEventSequence});
    if(state.presentationEvents.length>160)state.presentationEvents=state.presentationEvents.slice(-160);
  }
