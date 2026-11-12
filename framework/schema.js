/* Bearframe Engine Kit - portable, game-independent content contract.
 * No DOM, disk, clock, random source or Android dependencies.
 */
function validateEngineProject(project) {
  var errors=[], own=Object.prototype.hasOwnProperty;
  var ident=/^[a-z][a-z0-9_-]{0,63}$/;
  function fail(message){errors.push(message);}
  function record(v,label){if(!v||typeof v!=='object'||Array.isArray(v)){fail(label+' must be a record');return {};}return v;}
  function integer(v,low,high,label){if(!Number.isInteger(v)||v<low||v>high)fail(label+' must be integer '+low+'..'+high);}
  function id(v,label){if(typeof v!=='string'||!ident.test(v))fail(label+' must be a stable id');}
  function text(v,label){if(typeof v!=='string'||!v.trim()||v.length>10000)fail(label+' must be nonempty text');}
  function coords(key,map,label){
    var match=/^(0|[1-9][0-9]*),(0|[1-9][0-9]*)$/.exec(key);
    if(!match){fail(label+' invalid coordinates '+key);return;}
    var x=+match[1],y=+match[2];
    if(!map.rows[y]||map.rows[y][x]===undefined||map.rows[y][x]==='#')fail(label+' blocked or out of bounds '+key);
  }
  project=record(project,'project');id(project.id,'project.id');
  if(project.contentRevision!==undefined)
    id(project.contentRevision,'project.contentRevision');
  var maps=record(project.maps,'project.maps');
  var events=record(project.events,'project.events');
  var items=record(project.items,'project.items');
  var foes=record(project.foes,'project.foes');
  var quests=record(project.quests,'project.quests');
  // Free locomotion is explicitly opt-in. Historical saved map projects
  // remain strict four-cardinal tile movement without schema migrations.
  if(project.movement!==undefined){
    var locomotion=record(project.movement,'project.movement');
    if(locomotion.mode!=='free'&&locomotion.mode!=='tile')
      fail('project.movement.mode must be free or tile');
    Object.keys(locomotion).forEach(function(name){
      if(['mode','speed','radius'].indexOf(name)<0)
        fail('unknown project.movement option '+name);
    });
    if(locomotion.mode==='tile'&&
       (locomotion.speed!==undefined||locomotion.radius!==undefined))
      fail('tile movement does not accept free-motion tuning');
    if(locomotion.mode==='free'){
      if(locomotion.speed!==undefined)
        integer(locomotion.speed,8,64,'project.movement.speed');
      if(locomotion.radius!==undefined)
        integer(locomotion.radius,8,96,'project.movement.radius');
    }
  }
  var ruleRanges={
    playerHp:[1,9999],playerCharge:[1,999],baseAttack:[1,9999],
    pulseBonus:[0,9999],pulseCost:[1,99],guardReduction:[0,9999],
    foeBurstBonus:[0,9999],foeVariance:[1,99],victoryXp:[0,99999]
  };
  if(project.rules!==undefined) {
    var rules=record(project.rules,'project.rules');
    Object.keys(rules).forEach(function(name) {
      if(!own.call(ruleRanges,name))fail('unknown rule '+name);
      else integer(rules[name],ruleRanges[name][0],ruleRanges[name][1],'rule '+name);
    });
  }
  var mapIds=Object.keys(maps);
  if(!mapIds.length)fail('at least one map required');
  Object.keys(items).forEach(function(k){
    id(k,'item '+k);var item=record(items[k],'item '+k);
    text(item.name,'item '+k+'.name');
    if(['weapon','armor','accessory','consumable','key'].indexOf(item.kind)===-1)
      fail('item '+k+' invalid kind');
    integer(item.maxStack,1,9999,'item '+k+'.maxStack');
    if(item.kind==='weapon')integer(item.power,0,999,'item '+k+'.power');
    if(item.kind==='armor')integer(item.defense,0,999,'item '+k+'.defense');
    if(item.kind==='accessory'){
      var fields=['attack','defense','speed'];
      fields.forEach(function(field){
        if(own.call(item,field))integer(item[field],0,999,'item '+k+'.'+field);
      });
      if(!fields.some(function(field){return own.call(item,field);}))
        fail('item '+k+' accessory requires stat modifiers');
    }
    if(item.kind==='consumable')integer(item.heal,1,999,'item '+k+'.heal');
  });
  Object.keys(foes).forEach(function(k){
    id(k,'foe '+k);var foe=record(foes[k],'foe '+k);
    text(foe.name,'foe '+k+'.name');
    integer(foe.hp,1,99999,'foe '+k+'.hp');
    integer(foe.attack,0,9999,'foe '+k+'.attack');
    integer(foe.period,1,999,'foe '+k+'.period');
  });
  Object.keys(quests).forEach(function(k){
    id(k,'quest '+k);var q=record(quests[k],'quest '+k);
    if(!Array.isArray(q.stages)||!q.stages.length||q.stages.length>100)fail('quest '+k+' requires stages');
    else q.stages.forEach(function(v,i){text(v,'quest '+k+' stage '+i);});
  });
  function validTarget(target,label){
    if(!target||typeof target!=='object'){fail(label+' requires destination');return;}
    if(!own.call(maps,target.map)){fail(label+' missing destination map '+target.map);return;}
    integer(target.x,0,9999,label+'.x');integer(target.y,0,9999,label+'.y');
    var row=maps[target.map].rows&&maps[target.map].rows[target.y];
    if(typeof row!=='string'||row[target.x]===undefined||row[target.x]==='#')fail(label+' destination is blocked');
  }
  Object.keys(events).forEach(function(k){
    id(k,'event '+k);var ev=record(events[k],'event '+k);text(ev.text,'event '+k+'.text');
    if(ev.once!==undefined&&typeof ev.once!=='boolean')fail('event '+k+'.once must be boolean');
    if(!Array.isArray(ev.choices)||!ev.choices.length||ev.choices.length>20){fail('event '+k+' requires choices');return;}
    var choices={};
    ev.choices.forEach(function(choice,index){
      var label='event '+k+' choice '+index;choice=record(choice,label);
      id(choice.id,label+'.id');text(choice.text,label+'.text');
      if(own.call(choices,choice.id))fail(label+' duplicate choice '+choice.id);
      choices[choice.id]=true;
      if(!Array.isArray(choice.effects)||choice.effects.length>40){fail(label+' requires effects array');return;}
      choice.effects.forEach(function(effect,n){
        var e=record(effect,label+' effect '+n);
        var name=label+' effect '+n;
        switch(e.type){
          case 'flag':id(e.id,name+'.id');if(typeof e.value!=='boolean')fail(name+' invalid flag value');break;
          case 'give':case 'take':
            if(!own.call(items,e.item))fail(name+' unknown item '+e.item);
            integer(e.qty,1,9999,name+'.qty');break;
          case 'heal':case 'charge':integer(e.amount,1,9999,name+'.amount');break;
          case 'battle':if(!own.call(foes,e.foe))fail(name+' unknown foe '+e.foe);break;
          case 'quest':
            if(!own.call(quests,e.quest))fail(name+' unknown quest '+e.quest);
            else integer(e.stage,0,quests[e.quest].stages.length-1,name+'.stage');
            break;
          case 'recruit':id(e.ally,name+'.ally');break;
          case 'message':text(e.text,name+'.text');break;
          case 'warp':validTarget(e,name+'.warp');break;
          default:fail(name+' unknown effect '+e.type);
        }
      });
    });
  });
  mapIds.forEach(function(key){
    id(key,'map '+key);var map=record(maps[key],'map '+key);
    text(map.name,'map '+key+'.name');
    if(!Array.isArray(map.rows)||!map.rows.length||map.rows.length>256||typeof map.rows[0]!=='string'||!map.rows[0].length||map.rows[0].length>256){
      fail('map '+key+' requires rectangular rows (max 256x256)');return;
    }
    var width=map.rows[0].length;
    map.rows.forEach(function(row,i){
      if(typeof row!=='string'||row.length!==width||/[^.#]/.test(row))fail('map '+key+' row '+i+' must contain only # or . with matching width');
    });
    // Optional visual layers never affect movement collision or event
    // coordinates. A scenery tile may legitimately cover a wall cell.
    if(map.visualLayers!==undefined){
      if(!Array.isArray(map.visualLayers)||map.visualLayers.length>6)
        fail('map '+key+'.visualLayers must be at most 6 layers');
      else map.visualLayers.forEach(function(layer,n){
        var label='map '+key+'.visualLayers['+n+']';
        layer=record(layer,label);
        if(layer.depth!=='ground'&&layer.depth!=='canopy')
          fail(label+' depth must be ground or canopy');
        var cells=record(layer.cells,label+'.cells');
        Object.keys(cells).forEach(function(at){
          var match=/^(0|[1-9][0-9]*),(0|[1-9][0-9]*)$/.exec(at);
          if(!match||+match[1]>=width||+match[2]>=map.rows.length)
            fail(label+' out-of-bounds visual cell '+at);
          id(cells[at],label+' cell '+at);
        });
        if(Object.keys(cells).length>width*map.rows.length)
          fail(label+' too many visual cells');
      });
    }
    ['exits','events','encounters'].forEach(function(group){
      var entries=record(map[group],'map '+key+'.'+group);
      Object.keys(entries).forEach(function(where){
        coords(where,map,'map '+key+'.'+group);
        var value=entries[where];
        if(group==='exits')validTarget(value,'map '+key+' exit '+where);
        if(group==='events'&&!own.call(events,value))fail('map '+key+' unknown event '+value);
        if(group==='encounters'&&!own.call(foes,value))fail('map '+key+' unknown foe '+value);
      });
    });
  });
  validTarget(project.start,'project.start');
  if(project.partyCombat!==undefined){
    var spec=record(project.partyCombat,'project.partyCombat');
    var pcAllies=record(spec.allies,'project.partyCombat.allies');
    var pcEnemies=record(spec.enemies,'project.partyCombat.enemies');
    record(spec.skills,'project.partyCombat.skills');
    record(spec.player,'project.partyCombat.player');
    if(spec.progression!==undefined){
      record(spec.progression,'project.partyCombat.progression');
      if(!project.contentRevision)
        fail('Opt-in party progression requires contentRevision to protect existing saves');
    }
    Object.keys(foes).forEach(function(foe){
      if(!own.call(pcEnemies,foe))fail('Missing party combat enemy '+foe);
    });
    Object.keys(events).forEach(function(eventId){
      var event=events[eventId];
      if(!event||!Array.isArray(event.choices))return;
      event.choices.forEach(function(choice){
        if(!choice||!Array.isArray(choice.effects))return;
        choice.effects.forEach(function(effect){
          if(effect&&effect.type==='recruit'&&!own.call(pcAllies,effect.ally))
            fail('Party combat missing recruited ally '+effect.ally);
        });
      });
    });
  }
  if(errors.length)throw new TypeError('Invalid engine project ('+errors.length+'):\n'+errors.join('\n'));
  return project;
}
if(typeof module!=='undefined'&&module.exports)module.exports=validateEngineProject;
