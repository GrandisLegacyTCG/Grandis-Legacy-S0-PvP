    // PvP reader-only adapter: the server has ALREADY projected the public
    // journal for this recipient. Never inspect the opponent's private deck,
    // Hand or hidden chain state to build Card Played detail.
    getPublicCardPlayedDetail:function(side,eventId,publicJournal){
      side=side==='AI'?'AI':'PLAYER';
      if(!Array.isArray(publicJournal)||publicJournal.length>600)return null;
      var records=publicJournal.filter(function(e){return e&&e.id&&e.card_id&&(e.side==='AI'||e.side==='PLAYER');});
      var evt=records.find(function(e){return e.side===side&&e.id===eventId;});
      if(!evt)return null;
      // The donor's canonical formatter and response-chain grouping are shared
      // with standalone VS AI. A synthetic *public-only* state supplies the
      // journal; this must not be a raw authority snapshot.
      var projected={pvpHumanVsHuman:true,pvpActionEventsBySide:{
        PLAYER:records.filter(function(e){return e.side==='PLAYER';}),
        AI:records.filter(function(e){return e.side==='AI';})
      }};
      var groups=v96CombinedPlayedEvents(projected);
      var group=groups.find(function(g){return(g.side===side&&g.event&&g.event.id===eventId)||
        (g.chainEvents||[]).some(function(x){return x.side===side&&x.event&&x.event.id===eventId;});});
      if(group&&group.event!==evt)group=Object.assign({},group,{side:side,event:evt,fullChainRoot:group.event,fullChainRootSide:group.side});
      if(!group)group={side:side,event:evt,chainEvents:[]};
      return{title:evt.card_movement_only?'Card Discarded':'Card Played — '+v204PlayedActor(side,false),
        html:v94EventDetailHtml(group,side)};
    },
