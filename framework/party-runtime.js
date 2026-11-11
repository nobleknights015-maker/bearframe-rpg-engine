/* Bearframe Engine Kit: opt-in v2 party battle integration.
 * This adapter is called only by the canonical deterministic runtime.
 * The game session still owns the sole journal/sequence; no second save
 * namespace, UI, wall-clock or platform-specific battle state exists.
 */
function createBearframePartyRuntime(spec, project, rules) {
  if(!spec||typeof spec!=='object'||!spec.player||!spec.allies||!spec.enemies||
     typeof spec.allies!=='object'||typeof spec.enemies!=='object')
    throw new TypeError('Complete party combat project contract required');
  var factory=(typeof module!=='undefined'&&module.exports)?
    require('./party-combat.js'):createBearframePartyCombat;
  var core=factory(spec.skills), own=Object.prototype.hasOwnProperty;
  function has(o,k){return !!o&&own.call(o,k);}
  function copy(o){return JSON.parse(JSON.stringify(o));}
  function count(o){return Object.keys(o).length;}
  var player=copy(spec.player);
  if(!player||typeof player.id!=='string'||!player.id)
    throw new TypeError('Party player template ID required');
  var progression=null;
  if(spec.progression){
    var templates={};
    templates[player.id]=player;
    Object.keys(spec.allies).forEach(function(id){templates[id]=spec.allies[id];});
    var progressFactory=(typeof module!=='undefined'&&module.exports)?
      require('./progression.js'):createBearframeProgression;
    progression=progressFactory(spec.progression,spec.skills,templates);
    if(player.maxHp!==rules.playerHp||player.maxMp!==rules.playerCharge)
      throw new TypeError('Progression lead resource maxima must match world rules');
  }
  var enemyIds=Object.keys(project.foes);
  if(count(spec.enemies)!==enemyIds.length)throw new TypeError('Party enemy catalog mismatch');
  for(var i=0;i<enemyIds.length;i++){
    var foe=enemyIds[i];
    if(!has(spec.enemies,foe)||spec.enemies[foe].id!==foe)
      throw new TypeError('Missing party enemy template '+foe);
    core.begin([player],[spec.enemies[foe]],17);
  }
  Object.keys(spec.allies).forEach(function(key){
    if(spec.allies[key].id!==key||count(spec.allies)>5)
      throw new TypeError('Invalid party ally template '+key);
    core.begin([player,spec.allies[key]],[spec.enemies[enemyIds[0]]],17);
  });
  function initialize(state) {
    state.partyBattle=null;
    state.allyStats={};
  }
  function addAlly(state,id) {
    if(!has(spec.allies,id))throw new TypeError('Unsupported party ally '+id);
    if(has(state.allyStats,id))return;
    var actor=spec.allies[id];
    state.allyStats[id]={hp:actor.hp,mp:actor.mp};
    if(progression)state.allyStats[id].xp=0;
  }
  function valid(state){
    if(!state||!has(state,'partyBattle')||!state.allyStats||
       typeof state.allyStats!=='object'||Array.isArray(state.allyStats)||
       state.allies.length>5||count(state.allyStats)!==state.allies.length ||
       state.battle!==null)return false;
    var allocated={},slots=['weapon','armor','accessory'];
    function reserve(owner){
      for(var n=0;n<slots.length;n++){
        var slot=slots[n],id=owner[slot];
        if(id===undefined||id===null)continue;
        if(typeof id!=='string'||!has(project.items,id)||
           project.items[id].kind!==slot)return false;
        allocated[id]=(allocated[id]||0)+1;
      }
      return true;
    }
    if(!reserve(state.equipment))return false;
    if(progression){
      var expected=progression.derive(player.id,player,state.player.xp,true);
      if(state.player.maxHp!==expected.maxHp||
         state.player.maxCharge!==expected.maxMp)return false;
    }
    for(var i=0;i<state.allies.length;i++){
      var id=state.allies[i],member=state.allyStats[id],template=spec.allies[id];
      if(!template||!member)return false;
      var maximum=template;
      if(progression){
        if(!Number.isInteger(member.xp)||member.xp<0||member.xp>2147483647)
          return false;
        maximum=progression.derive(id,template,member.xp,false);
      }
      if(!Number.isInteger(member.hp)||member.hp<0||
         member.hp>maximum.maxHp||!Number.isInteger(member.mp)||
         member.mp<0||member.mp>maximum.maxMp||!reserve(member))return false;
    }
    var assigned=Object.keys(allocated);
    for(var n=0;n<assigned.length;n++)
      if((state.inventory[assigned[n]]||0)<allocated[assigned[n]])return false;
    if(state.partyBattle===null)return true;
    var b=state.partyBattle;
    if(!b||!has(spec.enemies,b.foe)||typeof b.origin!=='string'||
       b.origin.length>256||!b.origin||
       state.prompt!==null||!core.validateState(b.encounter)||
       b.encounter.phase!=='active'||b.encounter.foes.length!==1||
       b.encounter.foes[0].id!==b.foe||
       b.encounter.party.length!==state.allies.length+1||
       b.encounter.party[0].id!==player.id||
       b.encounter.party[0].name!==state.player.name)return false;
    for(var j=0;j<state.allies.length;j++)
      if(b.encounter.party[j+1].id!==state.allies[j])return false;
    return true;
  }
  function applyEquipment(actor,equipment){
    var weapon=equipment.weapon,armor=equipment.armor,accessory=equipment.accessory;
    if(weapon)actor.attack=Math.min(9999,actor.attack+project.items[weapon].power);
    if(armor)actor.defense=Math.min(9999,actor.defense+project.items[armor].defense);
    if(accessory){
      var item=project.items[accessory];
      actor.attack=Math.min(9999,actor.attack+(item.attack||0));
      actor.defense=Math.min(9999,actor.defense+(item.defense||0));
      actor.speed=Math.min(9999,actor.speed+(item.speed||0));
    }
  }
  function worldRoster(state){
    var lead=progression?
      progression.derive(player.id,player,state.player.xp,true):copy(player);
    lead.name=state.player.name;
    lead.hp=state.player.hp;lead.maxHp=state.player.maxHp;
    lead.mp=state.player.charge;lead.maxMp=state.player.maxCharge;
    applyEquipment(lead,state.equipment);
    var roster=[lead];
    for(var i=0;i<state.allies.length;i++){
      var id=state.allies[i],stats=state.allyStats[id];
      var actor=progression?
        progression.derive(id,spec.allies[id],stats.xp,false):copy(spec.allies[id]);
      actor.hp=stats.hp;actor.mp=stats.mp;
      applyEquipment(actor,stats);
      roster.push(actor);
    }
    return roster;
  }
  function gearView(state){
    var gear={},ids=[player.id].concat(state.allies);
    var owners=[state.equipment];
    for(var i=0;i<state.allies.length;i++)owners.push(state.allyStats[state.allies[i]]);
    for(var j=0;j<ids.length;j++){
      var owner=owners[j];
      gear[ids[j]]={weapon:owner.weapon||null,armor:owner.armor||null,
        accessory:owner.accessory||null};
    }
    return gear;
  }
  function equipmentView(state){
    var worn=gearView(state),view={};
    Object.keys(worn).forEach(function(id){view[id]=worn[id].weapon;});
    return view;
  }
  function progressView(state){
    if(!progression)return null;
    var view={};
    view[player.id]=progression.info(state.player.xp);
    for(var i=0;i<state.allies.length;i++){
      var id=state.allies[i];
      view[id]=progression.info(state.allyStats[id].xp);
    }
    return view;
  }
  function rosterView(state){
    // While fighting, the encounter owns live HP/MP/status values.
    // Outside encounters resources come from persisted player/ally state.
    return state.partyBattle?copy(state.partyBattle.encounter.party):worldRoster(state);
  }
  function healTarget(state,actorId,amount){
    if(!Number.isInteger(amount)||amount<1)return false;
    if(actorId===undefined||actorId===player.id){
      if(state.player.hp===state.player.maxHp)return false;
      state.player.hp=Math.min(state.player.maxHp,state.player.hp+amount);
      return true;
    }
    if(typeof actorId!=='string'||state.allies.indexOf(actorId)===-1||
       !has(state.allyStats,actorId))return false;
    var stats=state.allyStats[actorId],template=spec.allies[actorId];
    var limit=progression?
      progression.derive(actorId,template,stats.xp,false).maxHp:template.maxHp;
    if(!template||stats.hp===limit)return false;
    stats.hp=Math.min(limit,stats.hp+amount);
    return true;
  }
  function begin(state,foe,origin){
    if(!has(spec.enemies,foe)||state.partyBattle!==null)
      throw new TypeError('Unknown or overlapping party battle');
    state.partyBattle={foe:foe,origin:origin,
      encounter:core.begin(worldRoster(state),[spec.enemies[foe]],state.rng)};
    state.prompt=null;
    state.message='Party encounter started.';
  }
  function round(state,orders){
    if(!state.partyBattle)return false;
    var previous=state.partyBattle.encounter;
    var next=core.round(previous,orders);
    if(next===previous)return false;
    state.rng=next.rng;
    state.message=(next.log.join(' ')||'Party round completed.').slice(0,10000);
    if(next.phase==='active'){
      state.partyBattle.encounter=next;
      return true;
    }
    var was=state.partyBattle,lead=next.party[0];
    state.partyBattle=null;
    for(var i=0;i<state.allies.length;i++){
      var ally=next.party[i+1];
      // Preserve the member's persistent equipment and future progression
      // metadata. Replacing this record silently deleted geared inventory
      // reservations after combat, invalidating the world/gear contract.
      var resources=state.allyStats[ally.id];
      resources.hp=ally.hp;
      resources.mp=ally.mp;
    }
    if(next.phase==='victory'){
      var beforeXp=state.player.xp;
      state.player.xp=Math.min(2147483647,beforeXp+rules.victoryXp);
      if(progression){
        var beforeLead=progression.derive(player.id,player,beforeXp,true);
        var afterLead=progression.derive(player.id,player,state.player.xp,true);
        state.player.maxHp=afterLead.maxHp;
        state.player.maxCharge=afterLead.maxMp;
        state.player.hp=Math.min(afterLead.maxHp,Math.max(1,lead.hp)+
          (afterLead.maxHp-beforeLead.maxHp));
        state.player.charge=Math.min(afterLead.maxMp,lead.mp+
          (afterLead.maxMp-beforeLead.maxMp));
        for(var a=0;a<state.allies.length;a++){
          var allyId=state.allies[a],member=state.allyStats[allyId],oldXp=member.xp;
          var previous=progression.derive(allyId,spec.allies[allyId],oldXp,false);
          member.xp=Math.min(2147483647,oldXp+rules.victoryXp);
          var now=progression.derive(allyId,spec.allies[allyId],member.xp,false);
          member.hp=Math.min(now.maxHp,member.hp+(now.maxHp-previous.maxHp));
          member.mp=Math.min(now.maxMp,member.mp+(now.maxMp-previous.maxMp));
        }
      }else{
        state.player.hp=Math.max(1,lead.hp);
        state.player.charge=lead.mp;
      }
      if(was.origin.indexOf('encounter:')===0)
        state.flags[was.origin]=true;
      state.message='Party victory. '+state.message;
    }else{
      // Preserve the original runtime's fail-safe defeat recovery policy.
      state.player.map=project.start.map;
      state.player.x=project.start.x;state.player.y=project.start.y;
      state.player.hp=state.player.maxHp;
      state.player.charge=Math.min(2,state.player.maxCharge);
      state.message='Party encounter ended. Systems restored at starting location.';
    }
    return true;
  }
  return Object.freeze({initialize:initialize,addAlly:addAlly,valid:valid,
    begin:begin,round:round,rosterView:rosterView,
    equipmentView:equipmentView,gearView:gearView,
    progressView:progressView,healTarget:healTarget,playerId:player.id});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframePartyRuntime;
