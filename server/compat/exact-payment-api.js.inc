    applyExactManaPayment:function(uids,wantSurge,surgeUid){
      var p=appState&&appState.pending;
      if(!p||p.type!=='mana_shard_payment_choice'||p.decision_side!=='PLAYER')return false;
      if(!Array.isArray(uids)||uids.length>12||uids.some(function(x){return typeof x!=='string'||x.length>100;}))return false;
      var sel=uids.map(String),unique={};
      if(sel.some(function(x){if(unique[x])return true;unique[x]=true;return false;}))return false;
      var pool=manaPoolCardsForSide(appState,p.side),poolUid={};pool.forEach(function(sh){poolUid[String(sh.uid)]=true;});
      if(sel.some(function(x){return !poolUid[x];}))return false;
      var c=card(p.card_id),plan=computeExactManaPayment(appState,p.side,c,p.cost,sel);
      if(!plan.ok)return false;
      p.selected_shard_uids=sel;
      p.selected_class_uids=pool.filter(function(sh){return sh.kind==='CLASS'&&unique[String(sh.uid)];}).map(function(sh){return sh.uid;});
      p.use_magical_surge=false;p.selected_surge_mana_uid=null;
      if(wantSurge===true){
        var extra=String(surgeUid||''),info=manaPaymentSurgeSummary(appState,p);
        if(!extra||!poolUid[extra]||unique[extra]||!info||!info.available||Number(info.cost)!==1)return false;
        p.use_magical_surge=true;p.selected_surge_mana_uid=extra;
        info=manaPaymentSurgeSummary(appState,p);
        if(!info||!info.available||String(info.surge_mana_uid)!==extra)return false;
      }
      return commitManaShardPaymentChoice();
    },
    applyExactResponsePayment:function(uids){
      var p=appState&&appState.pending;
      if(!p||p.type!=='response_payment_choice'||p.decision_side!=='PLAYER')return false;
      if(!Array.isArray(uids)||uids.length>12||uids.some(function(x){return typeof x!=='string'||x.length>100;}))return false;
      var sel=uids.map(String),unique={};
      if(sel.some(function(x){if(unique[x])return true;unique[x]=true;return false;}))return false;
      var pool=manaPoolCardsForSide(appState,p.side),poolUid={};pool.forEach(function(sh){poolUid[String(sh.uid)]=true;});
      if(sel.some(function(x){return !poolUid[x];}))return false;
      var c=card(p.response_option&&p.response_option.card_id);
      if(!computeExactManaPayment(appState,p.side,c,p.mana_cost,sel).ok)return false;
      p.selected_shard_uids=sel;
      p.selected_mana_class_uids=pool.filter(function(sh){return sh.kind==='CLASS'&&unique[String(sh.uid)];}).map(function(sh){return sh.uid;});
      return commitResponsePaymentChoice();
    },
