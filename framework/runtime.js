/* Bearframe Engine Kit - deterministic, renderer-independent JRPG simulation.
 * One canonical project definition can run under Node, browser and Android/Rhino.
 * Does not import Sounding Ridge world data or depend on user interface objects.
 */
function createBearframeEngine(project) {
  var validate=(typeof module!=='undefined'&&module.exports)?require('./schema.js'):validateEngineProject;
  validate(project);
  // Capture the entire validated project before constructing any rule or party
  // adapters. Runtime determinism must not depend on mutable host-owned data.
  // This is an internal snapshot; save format and command semantics are unchanged.
  try{project=JSON.parse(JSON.stringify(project));}
  catch(error){throw new TypeError('Project must be JSON-serializable');}
  validate(project); // A custom toJSON must not bypass content validation.
  var contentContract=(typeof module!=='undefined'&&module.exports)?
    require('./content-contract.js'):createBearframeContentContract;
  var contentTag=contentContract(project);
  var own=Object.prototype.hasOwnProperty;
  var VERSION=project.partyCombat?2:1;
  var RULES={playerHp:30,playerCharge:3,baseAttack:5,pulseBonus:6,pulseCost:1,
    guardReduction:5,foeBurstBonus:3,foeVariance:3,victoryXp:10};
  if(project.rules)Object.keys(project.rules).forEach(function(k){RULES[k]=project.rules[k];});
  var freeFactory=project.movement&&project.movement.mode==='free'?
    (typeof module!=='undefined'&&module.exports?
      require('./free-movement.js'):createBearframeFreeMovement):null;
  var free=freeFactory?freeFactory(project):null;
  var partyFactory=project.partyCombat?
    (typeof module!=='undefined'&&module.exports?
      require('./party-runtime.js'):createBearframePartyRuntime):null;
  var party=partyFactory?partyFactory(project.partyCombat,project,RULES):null;
  function has(o,k){return !!o&&own.call(o,k);}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function number(v,min,max){return Number.isInteger(v)&&v>=min&&v<=max;}
  function cell(map,x,y){var rows=project.maps[map].rows;return rows[y]&&rows[y][x];}
  function isOpen(map,x,y){var c=cell(map,x,y);return c!==undefined&&c!== '#';}
  function key(x,y){return x+','+y;}
  function nextRand(s){var x=s.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng;}
  function fresh(name,seed) {
    var id=String(name==null?'':name).trim().slice(0,24)||'Frame';
    var value=number(seed,1,4294967295)?seed:0x9e3779b9;
    var state={version:VERSION,project:project.id,sequence:0,rng:value>>>0,
      player:{name:id,map:project.start.map,x:project.start.x,y:project.start.y,
        hp:RULES.playerHp,maxHp:RULES.playerHp,
        charge:RULES.playerCharge,maxCharge:RULES.playerCharge,xp:0},
      inventory:{},equipment:{weapon:null},flags:{},quests:{},allies:[],
      battle:null,prompt:null,message:'System initialized.'};
    if(free){
      var position=free.point(project.start.x,project.start.y);
      state.player.px=position.px;
      state.player.py=position.py;
    }
    if(party)party.initialize(state);
    return state;
  }
  function alive(s){return s.player.hp>0;}
  function valid(s) {
    if(!s||typeof s!=='object'||s.version!==VERSION||s.project!==project.id||
      !number(s.sequence,0,2147483647)||!number(s.rng,1,4294967295))return false;
    var p=s.player;
    if(!p||typeof p.name!=='string'||!p.name.trim()||p.name.length>24||
      !has(project.maps,p.map)||!number(p.x,0,255)||!number(p.y,0,255)||!isOpen(p.map,p.x,p.y)||
      !number(p.maxHp,1,9999)||!number(p.hp,1,p.maxHp)||!number(p.maxCharge,1,999)||
      !number(p.charge,0,p.maxCharge)||!number(p.xp,0,2147483647))return false;
    if(free&&(!number(p.px,0,65535)||!number(p.py,0,65535)||
      Math.floor(p.px/free.scale)!==p.x||
      Math.floor(p.py/free.scale)!==p.y||
      !free.inside(p.map,p.px,p.py)))return false;
    if(!s.inventory||typeof s.inventory!=='object'||Array.isArray(s.inventory)||
      !s.equipment||typeof s.equipment!=='object'||!s.flags||
      typeof s.flags!=='object'||!s.quests||typeof s.quests!=='object'||!Array.isArray(s.allies))return false;
    for(var item in s.inventory)if(has(s.inventory,item)){
      if(!has(project.items,item)||!number(s.inventory[item],1,project.items[item].maxStack))return false;
    }
    var slots=['weapon','armor','accessory'];
    for(var si=0;si<slots.length;si++){
      var slot=slots[si],worn=s.equipment[slot];
      if(worn!==undefined&&worn!==null&&
         (!has(project.items,worn)||project.items[worn].kind!==slot||!s.inventory[worn]))
        return false;
    }
    for(var flag in s.flags)if(has(s.flags,flag)&&typeof s.flags[flag]!=='boolean')return false;
    for(var q in s.quests)if(has(s.quests,q)){
      if(!has(project.quests,q)||!number(s.quests[q],0,project.quests[q].stages.length-1))return false;
    }
    var seen={};
    for(var i=0;i<s.allies.length;i++){
      var ally=s.allies[i];
      if(typeof ally!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/.test(ally)||seen[ally])return false;
      seen[ally]=true;
    }
    if(s.battle!==null) {
      var b=s.battle;
      if(!b||!has(project.foes,b.foe)||!number(b.hp,1,project.foes[b.foe].hp)||
        !number(b.turn,1,1000000)||typeof b.origin!=='string')return false;
    }
    if(s.prompt!==null) {
      var prompt=s.prompt;
      if(!prompt||!has(project.events,prompt.event)||typeof prompt.origin!=='string'||s.battle!==null)return false;
    }
    if(typeof s.message!=='string'||s.message.length>10000)return false;
    if(party&&!party.valid(s))return false;
    return true;
  }
  function restore(raw) {
    try{var s=typeof raw==='string'?JSON.parse(raw):clone(raw);
      return valid(s)?s:null;
    }catch(error){return null;}
  }
  function give(s,item,qty) {
    var max=project.items[item].maxStack;
    var newQty=(s.inventory[item]||0)+qty;
    if(newQty>max)return false;
    s.inventory[item]=newQty;return true;
  }
  function take(s,item,qty) {
    if((s.inventory[item]||0)<qty)return false;
    s.inventory[item]-=qty;
    if(!s.inventory[item])delete s.inventory[item];
    // Taking a wearable item must release reservations exceeding quantity.
    // Preserve the lead slot first, then enlisted allies in roster order.
    var slot=project.items[item].kind;
    if(['weapon','armor','accessory'].indexOf(slot)!==-1){
      var holders=[s.equipment],used=0;
      if(party)for(var n=0;n<s.allies.length;n++)
        holders.push(s.allyStats[s.allies[n]]);
      for(var i=0;i<holders.length;i++){
        var owner=holders[i];
        if(owner[slot]!==item)continue;
        if(used<(s.inventory[item]||0))used++;
        else if(i===0&&slot==='weapon')owner.weapon=null;
        else delete owner[slot];
      }
    }
    return true;
  }
  function gearOwner(s,actorId) {
    if(!party||actorId===undefined||actorId===party.playerId)return null;
    if(typeof actorId!=='string'||s.allies.indexOf(actorId)===-1)return false;
    return s.allyStats[actorId];
  }
  function equippedCount(s,item){
    var slot=project.items[item].kind;
    var count=s.equipment[slot]===item?1:0;
    if(party)for(var i=0;i<s.allies.length;i++)
      if(s.allyStats[s.allies[i]][slot]===item)count++;
    return count;
  }
  function equipTo(s,actorId,item){
    var owner=gearOwner(s,actorId);
    if(owner===false||!has(project.items,item)||!s.inventory[item])return false;
    var slot=project.items[item].kind;
    if(['weapon','armor','accessory'].indexOf(slot)===-1)return false;
    var target=owner===null?s.equipment:owner;
    if(target[slot]===item||equippedCount(s,item)>=s.inventory[item])return false;
    target[slot]=item;
    return true;
  }
  function unequipFrom(s,actorId,slot){
    var owner=gearOwner(s,actorId);
    if(owner===false||['weapon','armor','accessory'].indexOf(slot)===-1)return false;
    var target=owner===null?s.equipment:owner;
    if(target[slot]===undefined||target[slot]===null)return false;
    if(owner===null&&slot==='weapon')target.weapon=null;
    else delete target[slot];
    return true;
  }
  function beginBattle(s,foe,origin) {
    if(party){party.begin(s,foe,origin);return;}
    s.battle={foe:foe,hp:project.foes[foe].hp,turn:1,origin:origin};
    s.prompt=null;s.message=project.foes[foe].name+' approaches.';
  }
  function applyChoice(s,action) {
    if(!s.prompt||action.type!=='choose')return false;
    var ev=project.events[s.prompt.event],choice=null;
    for(var i=0;i<ev.choices.length;i++)if(ev.choices[i].id===action.id)choice=ev.choices[i];
    if(!choice)return false;
    // Fail the entire transaction before mutating any state.
    var balances=clone(s.inventory);
    for(var j=0;j<choice.effects.length;j++) {
      var e=choice.effects[j];
      if(e.type==='take') {
        if((balances[e.item]||0)<e.qty)return false;
        balances[e.item]-=e.qty;
        if(balances[e.item]===0)delete balances[e.item];
      } else if(e.type==='give'){
        balances[e.item]=(balances[e.item]||0)+e.qty;
        if(balances[e.item]>project.items[e.item].maxStack)return false;
      }
    }
    var origin=s.prompt.origin, eventId=s.prompt.event;
    s.prompt=null;
    if(ev.once)s.flags['event:'+origin]=true;
    for(var n=0;n<choice.effects.length;n++) {
      var effect=choice.effects[n];
      switch(effect.type) {
        case 'flag':s.flags[effect.id]=effect.value;break;
        case 'give':give(s,effect.item,effect.qty);break;
        case 'take':take(s,effect.item,effect.qty);break;
        case 'heal':s.player.hp=Math.min(s.player.maxHp,s.player.hp+effect.amount);break;
        case 'charge':s.player.charge=Math.min(s.player.maxCharge,s.player.charge+effect.amount);break;
        case 'battle':beginBattle(s,effect.foe,'event:'+origin);break;
        case 'quest':
          if(s.quests[effect.quest]===undefined||effect.stage>s.quests[effect.quest])s.quests[effect.quest]=effect.stage;
          break;
        case 'recruit':
          if(s.allies.indexOf(effect.ally)===-1){
            s.allies.push(effect.ally);
            if(party)party.addAlly(s,effect.ally);
          }
          break;
        case 'message':s.message=effect.text;break;
        case 'warp':
          s.player.map=effect.map;s.player.x=effect.x;s.player.y=effect.y;
          if(free){
            var warpPosition=free.point(effect.x,effect.y);
            s.player.px=warpPosition.px;s.player.py=warpPosition.py;
          }
          break;
      }
    }
    if(!choice.effects.some(function(e){return e.type==='message'||e.type==='battle';}))
      s.message=ev.text;
    return true;
  }
  function openEvent(s,id,origin){
    if(project.events[id].once&&s.flags['event:'+origin])return false;
    s.prompt={event:id,origin:origin};s.message=project.events[id].text;return true;
  }
  function moveFree(s,dir){
    var p=s.player,route=free.walk(p.map,p,dir);
    if(!route.ok)return false;
    var map=project.maps[p.map],moved=false;
    for(var i=0;i<route.steps.length;i++){
      var pos=route.steps[i],at=key(pos.x,pos.y);
      var crossed=pos.x!==p.x||pos.y!==p.y;
      if(crossed&&has(map.events,at)&&
         openEvent(s,map.events[at],p.map+':'+at))
        return true; // stop before touching an interactive event tile
      if(crossed&&has(map.exits,at)){
        var to=map.exits[at],spawn=free.point(to.x,to.y);
        p.map=to.map;p.x=to.x;p.y=to.y;
        p.px=spawn.px;p.py=spawn.py;
        s.message=project.maps[to.map].name;
        return true;
      }
      p.x=pos.x;p.y=pos.y;p.px=pos.px;p.py=pos.py;
      moved=true;
      if(crossed&&has(map.encounters,at)){
        // Exactly the same one-time origin key used by tile movement.
        var origin=p.map+':'+at;
        if(!s.flags['encounter:'+origin]){
          beginBattle(s,map.encounters[at],'encounter:'+origin);
          return true;
        }
      }
    }
    return moved;
  }
  function move(s,dir){
    if(free)return moveFree(s,dir);
    var delta={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[dir];
    if(!delta)return false;
    var p=s.player, nx=p.x+delta[0],ny=p.y+delta[1];
    if(!isOpen(p.map,nx,ny))return false;
    var map=project.maps[p.map],at=key(nx,ny),origin=p.map+':'+at;
    if(has(map.events,at)&&openEvent(s,map.events[at],origin))return true;
    // Completed one-time events become walkable; they must never trap the player.
    if(has(map.exits,at)){
      var to=map.exits[at];p.map=to.map;p.x=to.x;p.y=to.y;
      s.message=project.maps[to.map].name;return true;
    }
    p.x=nx;p.y=ny;
    if(has(map.encounters,at)&&!s.flags['encounter:'+origin])
      beginBattle(s,map.encounters[at],'encounter:'+origin);
    return true;
  }
  function combat(s,id) {
    if(!s.battle)return false;
    var b=s.battle,foe=project.foes[b.foe];
    if(id==='flee') {
      s.battle=null;s.message='You disengage.';return true;
    }
    if(['strike','pulse','guard'].indexOf(id)===-1)return false;
    if(id==='pulse'&&s.player.charge<RULES.pulseCost)return false;
    var guard=id==='guard';
    if(guard)s.player.charge=Math.min(s.player.maxCharge,s.player.charge+1);
    var power=s.equipment.weapon?project.items[s.equipment.weapon].power:0;
    var damage=guard?0:RULES.baseAttack+power+(id==='pulse'?RULES.pulseBonus:0);
    if(id==='pulse')s.player.charge-=RULES.pulseCost;
    b.hp=Math.max(0,b.hp-damage);
    if(b.hp===0){
      var origin=b.origin;
      if(origin.indexOf('encounter:')===0)s.flags[origin]=true;
      s.battle=null;s.player.xp=Math.min(2147483647,s.player.xp+RULES.victoryXp);
      s.message=foe.name+' defeated.';return true;
    }
    // Every battle action consumes exactly one deterministic PRNG step.
    var roll=nextRand(s)%RULES.foeVariance;
    var incoming=Math.max(1,foe.attack+(b.turn%foe.period===0?RULES.foeBurstBonus:0)+roll-(guard?RULES.guardReduction:0));
    s.player.hp=Math.max(0,s.player.hp-incoming);
    b.turn++;
    s.message='You deal '+damage+'. '+foe.name+' deals '+incoming+'.';
    if(s.player.hp===0){
      s.battle=null;s.player.map=project.start.map;s.player.x=project.start.x;
      s.player.y=project.start.y;s.player.hp=s.player.maxHp;
      if(free){
        var respawn=free.point(project.start.x,project.start.y);
        s.player.px=respawn.px;s.player.py=respawn.py;
      }
      s.player.charge=Math.min(2,s.player.maxCharge);
      s.message='Systems restored at the starting location.';
    }
    return true;
  }
  function step(previous,command) {
    if(!valid(previous)||!command||typeof command!=='object'||typeof command.type!=='string')return previous;
    var s=clone(previous),changed=false;
    if(party&&s.partyBattle) {
      if(command.type==='party-round')changed=party.round(s,command.orders);
    } else if(s.battle) {
      if(command.type==='combat')changed=combat(s,command.id);
    } else if(s.prompt) {
      if(command.type==='close'){s.prompt=null;changed=true;}
      else if(command.type==='choose')changed=applyChoice(s,command);
    } else {
      switch(command.type) {
        case 'move':changed=move(s,command.dir);break;
        case 'equip':
          changed=equipTo(s,command.actor,command.item);
          break;
        case 'unequip':
          changed=unequipFrom(s,command.actor,command.slot||'weapon');
          break;
        case 'use':
          if(has(project.items,command.item)&&project.items[command.item].kind==='consumable'&&s.inventory[command.item]){
            var healed=false;
            if(party)healed=party.healTarget(s,command.target,project.items[command.item].heal);
            else if(s.player.hp<s.player.maxHp){
              s.player.hp=Math.min(s.player.maxHp,s.player.hp+project.items[command.item].heal);
              healed=true;
            }
            if(healed){take(s,command.item,1);changed=true;}
          }
          break;
        case 'interact':
          var p=s.player,map=project.maps[p.map],at=key(p.x,p.y);
          if(has(map.events,at))changed=openEvent(s,map.events[at],p.map+':'+at);
          break;
      }
    }
    if(!changed)return previous;
    s.sequence++;if(!valid(s))throw new Error('Engine transition produced invalid state for '+command.type);
    return s;
  }
  function view(s){
    if(!valid(s))throw new TypeError('Invalid engine state');
    var p=s.player,map=project.maps[p.map];
    var result={project:project.id,sequence:s.sequence,map:p.map,mapName:map.name,
      rows:map.rows.slice(),x:p.x,y:p.y,hp:p.hp,maxHp:p.maxHp,
      charge:p.charge,maxCharge:p.maxCharge,xp:p.xp,weapon:s.equipment.weapon,
      inventory:clone(s.inventory),equipment:clone(s.equipment),quests:clone(s.quests),
      battle:s.battle?clone(s.battle):null,prompt:s.prompt?clone(s.prompt):null,
      message:s.message,allies:s.allies.slice()};
    result.movementMode=free?'free':'tile';
    if(free)result.freePosition={
      x:p.px/free.scale-0.5,y:p.py/free.scale-0.5
    };
    if(party){
      result.partyBattle=s.partyBattle?clone(s.partyBattle):null;
      result.partyActors=party.rosterView(s);
      result.partyEquipment=party.equipmentView(s);
      result.partyGear=party.gearView(s);
      var progress=party.progressView(s);
      if(progress)result.partyProgression=progress;
      if(s.partyBattle){
        // HUD resources show live encounter state, not pre-battle checkpoint.
        result.hp=result.partyActors[0].hp;
        result.charge=result.partyActors[0].mp;
      }
    }
    return result;
  }
  return Object.freeze({version:VERSION,projectId:project.id,contentTag:contentTag,fresh:fresh,
    restore:restore,step:step,view:view,serialize:function(s){if(!valid(s))throw new TypeError('Invalid state');return JSON.stringify(s);},
    validateState:valid});
}
if(typeof module!=='undefined'&&module.exports)module.exports=createBearframeEngine;
