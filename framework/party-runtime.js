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
  }
  function valid(state){
    if(!state||!has(state,'partyBattle')||!state.allyStats||
       typeof state.allyStats!=='object'||Array.isArray(state.allyStats)||
       state.allies.length>5||count(state.allyStats)!==state.allies.length ||
       state.battle!==null)return false;
    for(var i=0;i<state.allies.length;i++){
      var id=state.allies[i],member=state.allyStats[id],template=spec.allies[id];
      if(!template||!member||!Number.isInteger(member.hp)||member.hp<0||
         member.hp>template.maxHp||!Number.isInteger(member.mp)||
         member.mp<0||member.mp>template.maxMp)return false;
    }
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
  function begin(state,foe,origin){
    if(!has(spec.enemies,foe)||state.partyBattle!==null)
      throw new TypeError('Unknown or overlapping party battle');
    var lead=copy(player);
    lead.name=state.player.name;
    lead.hp=state.player.hp;lead.maxHp=state.player.maxHp;
    lead.mp=state.player.charge;lead.maxMp=state.player.maxCharge;
    var roster=[lead];
    for(var i=0;i<state.allies.length;i++){
      var id=state.allies[i],actor=copy(spec.allies[id]),stats=state.allyStats[id];
      actor.hp=stats.hp;actor.mp=stats.mp;roster.push(actor);
    }
    state.partyBattle={foe:foe,origin:origin,
      encounter:core.begin(roster,[spec.enemies[foe]],state.rng)};
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
      state.allyStats[ally.id]={hp:ally.hp,mp:ally.mp};
    }
    if(next.phase==='victory'){
      state.player.hp=Math.max(1,lead.hp);
      state.player.charge=lead.mp;
      state.player.xp=Math.min(2147483647,state.player.xp+rules.victoryXp);
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
    begin:begin,round:round,playerId:player.id});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframePartyRuntime;
