  function recordPublicSelectedPickup(state,side,cardId,sourceZone,sourceCardId,handIndex,commitToken){
    if(!state||!cardId||['Main Deck','Discard'].indexOf(sourceZone)===-1)return;
    state.presentationEvents=Array.isArray(state.presentationEvents)?state.presentationEvents:[];
    state.presentationEventSequence=Number(state.presentationEventSequence||0)+1;
    var action=null;
    if(state.pvpHumanVsHuman&&commitToken){
      action=((state.pvpActionEventsBySide||{})[side]||[]).find(function(e){
        return e&&e.commit_token===commitToken&&e.card_id===sourceCardId;
      })||null;
      if(action){
        action.card_movements=action.card_movements||[];
        action.card_movements.push({from:sourceZone,to:'Hand',count:1,card_ids:[cardId],known:true});
      }
    }
    state.presentationEvents.push({id:'PICKUP-'+state.presentationEventSequence,
      type:'CARD_PUBLIC_PICKUP',side:side,card_id:cardId,from_zone:sourceZone,
      source_card_id:sourceCardId||null,source_action_id:action&&action.id||null,
      hand_index:Number(handIndex),sequence:state.presentationEventSequence});
    if(state.presentationEvents.length>160)state.presentationEvents=state.presentationEvents.slice(-160);
  }
