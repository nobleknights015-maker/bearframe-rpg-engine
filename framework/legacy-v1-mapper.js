/* Explicit historical Rhino v1 -> portable v1 state mapper.
 * Requires a compatible destination PROJECT plus a reviewed mapping for
 * every legacy area, equipment item, foe, prompt and ally. This module does
 * not provide game content, promise gameplay parity, or perform any storage I/O.
 * Migration can be committed only through save-import after independent
 * original-world validation and a full source-state round-trip.
 */
function createBearframeLegacyV1Mapper(config){
  if(!config||!config.engine||!config.mapping||
     typeof config.legacyRestore!=='function'||
     typeof config.engine.fresh!=='function'||
     typeof config.engine.serialize!=='function'||
     typeof config.engine.restore!=='function'||
     config.engine.version!==1)
    throw new TypeError('Engine v1 and reviewed original restore/map required');
  var legacy=(typeof module!=='undefined'&&module.exports)?
    require('./legacy-save-v1.js'):BearframeLegacyV1;
  var maps=config.mapping.maps,weapons=config.mapping.weapons,
      foes=config.mapping.foes,prompts=config.mapping.prompts,
      allies=config.mapping.allies;
  var required={maps:['pod','gallery','ridge'],
    weapons:['blade','lance'],foes:['H','E','D'],
    prompts:['G','C','E','T','D','H','M'],
    allies:['echoAlly','gridAlly']};
  var lookups={},reverse={};
  Object.keys(required).forEach(function(kind){
    var v={maps:maps,weapons:weapons,foes:foes,prompts:prompts,allies:allies}[kind];
    if(!v||typeof v!=='object'||Array.isArray(v)||
       Object.keys(v).length!==required[kind].length)
      throw new TypeError('Incomplete legacy '+kind+' mapping');
    var inverse={};
    required[kind].forEach(function(key){
      var id=v[key];
      if(typeof id!=='string'||!id||Object.prototype.hasOwnProperty.call(inverse,id))
        throw new TypeError('Invalid, duplicate legacy '+kind+' mapping '+key);
      inverse[id]=key;
    });
    lookups[kind]=v;reverse[kind]=inverse;
  });
  var flagKeys=['bearing','E','D','H','echoAlly','gridAlly','met'];
  var finishKeys=['Ash','Slate','Ivory'];
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function validatedOriginal(original){
    var raw=JSON.stringify(original);
    legacy.decode(raw);
    var restored=config.legacyRestore(raw);
    if(!restored||JSON.stringify(restored)!==raw)
      throw new TypeError('Original game-world restore rejected migration source');
    return original;
  }
  function map(original){
    var s=validatedOriginal(clone(original));
    var target=config.engine.fresh(s.name,0x9e3779b9);
    target.player.name=s.name;
    target.player.map=maps[s.area];target.player.x=s.x;target.player.y=s.y;
    target.player.hp=s.hp;
    target.player.maxHp=s.flags.bearing?36:30;
    target.player.charge=s.charge;target.player.maxCharge=3;
    target.flags=clone(s.flags);
    target.flags['legacy-finish:'+s.finish]=true;
    if(s.weapon!==null){
      var mappedWeapon=weapons[s.weapon];
      target.inventory[mappedWeapon]=1;
      target.equipment.weapon=mappedWeapon;
    }
    if(s.flags.echoAlly)target.allies.push(allies.echoAlly);
    if(s.flags.gridAlly)target.allies.push(allies.gridAlly);
    if(s.battle!==null){
      target.battle={foe:foes[s.battle.key],hp:s.battle.hp,
        turn:s.battle.turn,origin:'legacy-import'};
    }
    if(s.prompt!==null){
      target.prompt={event:prompts[s.prompt],origin:'legacy-import'};
    }
    target.message=s.message;
    var body;
    try{body=config.engine.serialize(target);}
    catch(error){throw new TypeError('Destination project rejected mapped legacy state');}
    var checked=config.engine.restore(body);
    if(!checked)throw new TypeError('Destination project rejected mapped legacy state');
    if(JSON.stringify(unmap(checked))!==JSON.stringify(s))
      throw new TypeError('Historical state conversion dropped a field');
    return checked;
  }
  function unmap(state){
    if(!state||state.sequence!==0||!config.engine.restore(config.engine.serialize(state)))
      throw new TypeError('Reverse conversion requires untouched imported revision 0');
    var f=state.flags;
    var matches=finishKeys.filter(function(id){return f['legacy-finish:'+id]===true;});
    if(matches.length!==1)throw new TypeError('Historical finish not preserved');
    var flags={};
    flagKeys.forEach(function(k){
      if(typeof f[k]!=='boolean')throw new TypeError('Missing historical flag '+k);
      flags[k]=f[k];
    });
    var result={v:1,name:state.player.name,finish:matches[0],
      area:reverse.maps[state.player.map],x:state.player.x,y:state.player.y,
      hp:state.player.hp,charge:state.player.charge,weapon:state.equipment.weapon===null?
      null:reverse.weapons[state.equipment.weapon],flags:flags,
      battle:state.battle?{
        key:reverse.foes[state.battle.foe],hp:state.battle.hp,turn:state.battle.turn
      }:null,
      prompt:state.prompt?reverse.prompts[state.prompt.event]:null,
      message:state.message};
    return validatedOriginal(result);
  }
  return Object.freeze({map:map,unmap:unmap});
}
if(typeof module!=='undefined'&&module.exports)
 module.exports=createBearframeLegacyV1Mapper;
