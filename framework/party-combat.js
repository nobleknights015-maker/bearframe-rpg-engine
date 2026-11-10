/* Bearframe Engine Kit: deterministic multi-actor, round-based JRPG combat.
 * All entities and actions are data; no story, UI, clock, I/O or platform dependencies.
 */
function createBearframePartyCombat(skillBook) {
  var own=Object.prototype.hasOwnProperty;
  function has(o,k){return !!o&&own.call(o,k);}
  function int(n,lo,hi){return Number.isInteger(n)&&n>=lo&&n<=hi;}
  function id(x){return typeof x==='string'&&/^[a-z][a-z0-9_-]{0,63}$/.test(x);}
  if(!skillBook||typeof skillBook!=='object'||Array.isArray(skillBook)||!Object.keys(skillBook).length)
    throw new TypeError('Nonempty skill catalog required');
  Object.keys(skillBook).forEach(function(key){
    var k=skillBook[key];
    if(!id(key)||!k||['damage','heal','guard'].indexOf(k.kind)===-1||
       !int(k.power,0,9999)||!int(k.cost,0,999)||!id(k.element))
      throw new TypeError('Invalid skill '+key);
    if(k.kind==='guard'&&k.power!==0)throw new TypeError('Guard skill must have zero power');
    if(k.status){
      if(k.kind!=='damage'||k.status.type!=='poison'||!int(k.status.turns,1,20)||
         !int(k.status.potency,1,999))
        throw new TypeError('Invalid status effect '+key);
    }
  });
  // Snapshot the validated catalog: callers must not change combat rules mid-save.
  skillBook=JSON.parse(JSON.stringify(skillBook));
  function clone(x){return JSON.parse(JSON.stringify(x));}
  function actorValid(a){
    if(!a||!id(a.id)||typeof a.name!=='string'||!a.name.trim()||a.name.length>80||
       !int(a.maxHp,1,99999)||!int(a.hp,0,a.maxHp)||
       !int(a.maxMp,0,9999)||!int(a.mp,0,a.maxMp)||
       !int(a.attack,0,9999)||!int(a.defense,0,9999)||!int(a.speed,0,9999)||
       !Array.isArray(a.skills)||!a.skills.length||a.skills.length>50||
       !a.skills.every(function(k){return has(skillBook,k);})||
       !a.skills.every(function(k,i){return a.skills.indexOf(k)===i;})||
       !a.resistances||typeof a.resistances!=='object'||Array.isArray(a.resistances)||
       typeof a.guarding!=='boolean'||!Array.isArray(a.statuses)||a.statuses.length>10)return false;
    for(var element in a.resistances)if(has(a.resistances,element)){
      if(!id(element)||!int(a.resistances[element],0,200))return false;
    }
    var statusTypes={};
    for(var i=0;i<a.statuses.length;i++){
      var s=a.statuses[i];
      if(!s||s.type!=='poison'||!int(s.turns,1,20)||!int(s.potency,1,999)||has(statusTypes,s.type))return false;
      statusTypes[s.type]=true;
    }
    return true;
  }
  function normalize(a){
    var n=clone(a);
    n.guarding=false;n.statuses=[];
    if(n.resistances===undefined)n.resistances={};
    return n;
  }
  function stateValid(s) {
    if(!s||s.version!==1||!int(s.turn,1,1000000)||!int(s.rng,1,4294967295)||
       ['active','victory','defeat','draw'].indexOf(s.phase)===-1||
       !Array.isArray(s.party)||!Array.isArray(s.foes)||
       s.party.length<1||s.party.length>6||s.foes.length<1||s.foes.length>12||
       !Array.isArray(s.log)||s.log.length>100||!s.log.every(function(line){return typeof line==='string'&&line.length<=200;}))
      return false;
    var ids={};
    for(var i=0;i<s.party.length+s.foes.length;i++){
      var a=i<s.party.length?s.party[i]:s.foes[i-s.party.length];
      if(!actorValid(a)||has(ids,a.id))return false;
      ids[a.id]=true;
    }
    var aliveParty=s.party.some(function(a){return a.hp>0;});
    var aliveFoes=s.foes.some(function(a){return a.hp>0;});
    if(s.phase==='victory'&&(!aliveParty||aliveFoes)||
       s.phase==='defeat'&&(aliveParty||!aliveFoes)||
       s.phase==='draw'&&(aliveParty||aliveFoes)||
       s.phase==='active'&&(!aliveParty||!aliveFoes))return false;
    return true;
  }
  function begin(party,foes,seed){
    if(!Array.isArray(party)||!Array.isArray(foes))throw new TypeError('Combat rosters required');
    var s={version:1,turn:1,rng:int(seed,1,4294967295)?seed>>>0:0x6d2b79f5,
      phase:'active',party:party.map(normalize),foes:foes.map(normalize),log:[]};
    if(!stateValid(s))throw new TypeError('Invalid party or enemy roster');
    return s;
  }
  function restore(raw){
    try {var s=typeof raw==='string'?JSON.parse(raw):clone(raw);
      return stateValid(s)?s:null;}catch(error){return null;}
  }
  function random(s,max){
    var n=s.rng>>>0;n^=n<<13;n^=n>>>17;n^=n<<5;s.rng=n>>>0;
    return s.rng%max;
  }
  function find(list,idValue){
    for(var i=0;i<list.length;i++)if(list[i].id===idValue)return list[i];
    return null;
  }
  function chooseEnemySkill(actor) {
    for(var i=0;i<actor.skills.length;i++){
      var key=actor.skills[i],skill=skillBook[key];
      if(skill.kind==='damage'&&actor.mp>=skill.cost)return key;
    }
    return null;
  }
  function round(previous,orders){
    // Refuse advancement at the journal's turn ceiling instead of throwing after a valid round.
    if(!stateValid(previous)||previous.phase!=='active'||previous.turn>=1000000||!Array.isArray(orders))return previous;
    var alive=previous.party.filter(function(a){return a.hp>0;});
    if(orders.length!==alive.length)return previous;
    var seen={};
    for(var i=0;i<orders.length;i++){
      var o=orders[i],actor=o&&find(alive,o.actor),skill=actor&&skillBook[o.skill];
      if(!actor||has(seen,o.actor)||!skill||actor.skills.indexOf(o.skill)<0||actor.mp<skill.cost)
        return previous;
      if(skill.kind!=='guard'){
        var targets=skill.kind==='heal'?previous.party:previous.foes;
        var target=find(targets,o.target);
        if(!target||target.hp<=0)return previous;
      }
      seen[o.actor]=true;
    }
    var s=clone(previous);s.log=[];
    var order=orders.map(function(o){
      return {side:'party',actor:o.actor,skill:o.skill,target:o.target};
    });
    s.foes.forEach(function(enemy){
      if(enemy.hp>0){
        var chosen=chooseEnemySkill(enemy);
        if(chosen) {
          var targets=s.party.filter(function(x){return x.hp>0;});
          var chosenTarget=targets[random(s,targets.length)];
          order.push({side:'foes',actor:enemy.id,skill:chosen,target:chosenTarget.id});
        }
      }
    });
    order.sort(function(a,b){
      var aa=find(a.side==='party'?s.party:s.foes,a.actor),bb=find(b.side==='party'?s.party:s.foes,b.actor);
      return bb.speed-aa.speed||(a.actor<b.actor?-1:a.actor>b.actor?1:0);
    });
    s.party.concat(s.foes).forEach(function(actor){actor.guarding=false;});
    for(var j=0;j<order.length;j++){
      var cmd=order[j],allies=cmd.side==='party'?s.party:s.foes;
      var opponents=cmd.side==='party'?s.foes:s.party;
      var a=find(allies,cmd.actor);if(!a||a.hp<=0)continue;
      var k=skillBook[cmd.skill];
      if(a.mp<k.cost)continue;
      var target=k.kind==='guard'?a:find(k.kind==='heal'?allies:opponents,cmd.target);
      if((!target||target.hp<=0)&&cmd.side==='foes'&&k.kind==='damage')
        target=opponents.filter(function(x){return x.hp>0;})[0];
      if(!target||target.hp<=0)continue;
      a.mp-=k.cost;
      if(k.kind==='guard'){
        a.guarding=true;s.log.push(a.name+' guards.');
      }else if(k.kind==='heal'){
        var heal=Math.min(target.maxHp-target.hp,a.attack+k.power);
        target.hp+=heal;s.log.push(a.name+' restores '+heal+' to '+target.name+'.');
      }else{
        var variance=random(s,3)-1;
        var raw=Math.max(1,a.attack+k.power-Math.floor(target.defense/2)+variance);
        var resistance=has(target.resistances,k.element)?target.resistances[k.element]:100;
        var damage=Math.max(resistance===0?0:1,Math.floor(raw*resistance/100));
        if(target.guarding)damage=Math.floor(damage/2);
        target.hp=Math.max(0,target.hp-damage);
        s.log.push(a.name+' hits '+target.name+' for '+damage+'.');
        if(k.status&&target.hp>0){
          var prior=target.statuses.filter(function(st){return st.type===k.status.type;})[0];
          if(prior){prior.turns=Math.max(prior.turns,k.status.turns);prior.potency=Math.max(prior.potency,k.status.potency);}
          else target.statuses.push(clone(k.status));
        }
      }
      if(s.foes.every(function(x){return x.hp===0})||s.party.every(function(x){return x.hp===0}))break;
    }
    if(s.foes.some(function(x){return x.hp>0})&&s.party.some(function(x){return x.hp>0})){
      s.party.concat(s.foes).forEach(function(a){
        if(a.hp<=0)return;
        var remain=[];
        a.statuses.forEach(function(status){
          if(status.type==='poison'){
            var loss=Math.min(a.hp,status.potency);
            a.hp-=loss;s.log.push(a.name+' loses '+loss+' to poison.');
          }
          status.turns--;if(status.turns>0&&a.hp>0)remain.push(status);
        });
        a.statuses=remain;
      });
    }
    if(s.foes.every(function(x){return x.hp===0})&&s.party.every(function(x){return x.hp===0}))s.phase='draw';
    else if(s.foes.every(function(x){return x.hp===0}))s.phase='victory';
    else if(s.party.every(function(x){return x.hp===0}))s.phase='defeat';
    else s.turn++;
    if(!stateValid(s))throw new Error('Party combat produced invalid state');
    return s;
  }
  return Object.freeze({begin:begin,round:round,restore:restore,
    validateState:stateValid,serialize:function(s){if(!stateValid(s))throw new TypeError('Invalid combat state');return JSON.stringify(s);}});
}
if(typeof module!=='undefined'&&module.exports)module.exports=createBearframePartyCombat;
