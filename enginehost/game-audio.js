/* Bearframe optional gameplay-audio host: no simulation state or save writes.
 * All clips come from a caller-supplied, validated offline catalog.
 * Sound cannot autoplay on launch or after Android resume: an explicit
 * Settings/Enable sound gesture is required every foreground session.
 */
function createBearframeGameAudio(profile,createElement,options){
  var node=typeof module!=='undefined'&&module.exports;
  var Director=node?require('../framework/audio.js'):createBearframeAudioDirector;
  var Backend=node?require('../framework/audio-browser.js'):createBearframeBrowserAudioBackend;
  options=options||{};
  if(typeof createElement!=='function')
    throw new TypeError('Audio element factory required');
  var enabledProfile=profile!==null&&profile!==undefined;
  if(enabledProfile){
    if(!profile||typeof profile!=='object'||Array.isArray(profile)||
       profile.version!==1||!profile.catalog||
       typeof profile.catalog!=='object'||Array.isArray(profile.catalog))
      throw new TypeError('Gameplay audio profile must be version 1');
    Object.keys(profile).forEach(function(k){
      if(['version','catalog','cues','music'].indexOf(k)<0)
        throw new TypeError('Unknown gameplay audio profile field '+k);
    });
  }
  var catalog=enabledProfile?profile.catalog:{};
  var director=Director(catalog),state=director.fresh();
  var own=Object.prototype.hasOwnProperty;
  var allowedCues=['menu_open','menu_close','menu_select','step','door',
    'event','battle_start','battle_round','battle_end','item','save'];
  var cues=Object.create(null);
  var music={maps:Object.create(null),default:null,battle:null};
  var ident=/^[a-z][a-z0-9_-]{0,63}$/;
  function record(x){return !!x&&typeof x==='object'&&!Array.isArray(x);}
  if(enabledProfile){
    if(profile.cues!==undefined&&!record(profile.cues))
      throw new TypeError('Audio cue record required');
    Object.keys(profile.cues||{}).forEach(function(key){
      var id=profile.cues[key];
      if(allowedCues.indexOf(key)<0||typeof id!=='string'||
         !own.call(catalog,id)||catalog[id].type!=='sfx')
        throw new TypeError('Invalid gameplay sound cue '+key);
      cues[key]=id;
    });
    if(profile.music!==undefined){
      if(!record(profile.music))
        throw new TypeError('Audio music mapping required');
      Object.keys(profile.music).forEach(function(k){
        if(['maps','default','battle'].indexOf(k)<0)
          throw new TypeError('Invalid music mapping field '+k);
      });
      ['default','battle'].forEach(function(k){
        if(profile.music[k]!==undefined&&profile.music[k]!==null){
          var id=profile.music[k];
          if(typeof id!=='string'||!own.call(catalog,id)||
             catalog[id].type!=='music')
            throw new TypeError('Invalid gameplay music '+k);
          music[k]=id;
        }
      });
      if(profile.music.maps!==undefined){
        if(!record(profile.music.maps))throw new TypeError('Audio map music required');
        Object.keys(profile.music.maps).forEach(function(mapId){
          var id=profile.music.maps[mapId];
          if(!ident.test(mapId)||typeof id!=='string'||
             !own.call(catalog,id)||catalog[id].type!=='music')
            throw new TypeError('Invalid map soundtrack '+mapId);
          if(options.project&&(!options.project.maps||
             !own.call(options.project.maps,mapId)))
            throw new TypeError('Soundtrack maps to unknown area '+mapId);
          music.maps[mapId]=id;
        });
      }
    }
  }
  if(options.requestFocus!==undefined&&typeof options.requestFocus!=='function')
    throw new TypeError('Audio focus request must be a function');
  if(options.releaseFocus!==undefined&&typeof options.releaseFocus!=='function')
    throw new TypeError('Audio focus release must be a function');
  var createBackend=function(){return Backend(createElement,{maxSfxVoices:6,
    assetPrefix:options.assetPrefix||''});};
  var backend=createBackend(),armed=false,disposed=false,suspended=false;
  var currentView=null,lastError=null,requestSerial=0;
  function report(promise){
    return Promise.resolve(promise).then(function(results){
      if(disposed)return {ok:false,reason:'disposed'};
      var failures=results.filter(function(r){return !r.ok;});
      if(failures.length){
        lastError=failures[0].reason||'playback-unavailable';
        // Playback rejection requires an explicit new gesture, not a
        // silent retry from RAF or a lifecycle callback.
        if(lastError==='play-rejected'||lastError==='play-threw'){
          armed=false;
          backend.dispose();
          if(options.releaseFocus)options.releaseFocus();
        }
      }else lastError=null;
      return failures[0]||{ok:true};
    },function(error){
      lastError='backend-error';
      return {ok:false,reason:lastError,message:String(error&&error.message||error)};
    });
  }
  function apply(action){
    var result=director.apply(state,action);
    state=result.state;
    if(!result.commands.length)return Promise.resolve({ok:true,noCommand:true});
    if(!armed||disposed)return Promise.resolve({ok:false,reason:'audio-disabled'});
    return report(backend.execute(result.commands));
  }
  function soundtrack(view){
    if(!view)return null;
    if(view.partyBattle||view.battle)return music.battle||music.default;
    return music.maps[view.map]||music.default;
  }
  function updateMusic(){
    if(!armed||disposed||suspended)return Promise.resolve({ok:false,reason:'audio-disabled'});
    var next=soundtrack(currentView);
    if(!next)return apply({type:'stopMusic'});
    return apply({type:'music',id:next});
  }
  function signal(name){
    if(allowedCues.indexOf(name)<0)return Promise.resolve({ok:false,reason:'unknown-cue'});
    if(!armed||disposed||suspended)return Promise.resolve({ok:false,reason:'audio-disabled'});
    if(!own.call(cues,name))return Promise.resolve({ok:false,reason:'cue-unbound'});
    return apply({type:'sfx',id:cues[name]});
  }
  function scene(before,after,action){
    if(after)currentView={map:after.map,
      partyBattle:!!after.partyBattle,battle:!!after.battle};
    if(!armed||disposed||suspended||!after)return;
    if(before&&before.map!==after.map)signal('door');
    var preCombat=!!(before&&(before.partyBattle||before.battle));
    var postCombat=!!(after.partyBattle||after.battle);
    if(!preCombat&&postCombat)signal('battle_start');
    else if(preCombat&&!postCombat)signal('battle_end');
    else if(preCombat&&postCombat&&before.sequence!==after.sequence)
      signal('battle_round');
    else if(action==='move'&&before&&before.sequence!==after.sequence&&
       before.map===after.map)signal('step');
    else if(action==='choose')signal('event');
    else if(['equip','unequip','use'].indexOf(action)>=0)signal('item');
    updateMusic();
  }
  function enable(){
    if(disposed)return Promise.resolve({ok:false,reason:'disposed'});
    if(!enabledProfile)return Promise.resolve({ok:false,reason:'no-soundtrack-packaged'});
    if(suspended)return Promise.resolve({ok:false,reason:'background'});
    if(armed)return Promise.resolve({ok:true});
    // Must be invoked *directly* within a user gesture.
    if(options.requestFocus){
      var focusOk=false;
      try{focusOk=options.requestFocus()===true;}catch(e){}
      if(!focusOk)return Promise.resolve({ok:false,reason:'audio-focus-unavailable'});
    }
    if(backend.status().destroyed)backend=createBackend();
    armed=true;lastError=null;requestSerial++;
    // A foreground gesture opts into background-safe soundtrack playback.
    return updateMusic();
  }
  function disable(){
    if(disposed)return;
    armed=false;
    backend.dispose();
    backend=createBackend();
    // Turning audio off must not silently reset the user's volume/mute
    // preferences. These are session-local presentation state, not saves.
    var previous=state;
    state=director.fresh();
    ['master','music','sfx'].forEach(function(bus){
      state=director.apply(state,{type:'volume',bus:bus,
        value:previous.volumes[bus]}).state;
    });
    if(previous.muted)state=director.apply(state,{type:'mute'}).state;
    if(options.releaseFocus)options.releaseFocus();
  }
  function mute(flag){
    if(typeof flag!=='boolean')return Promise.resolve({ok:false,reason:'invalid-mute'});
    var result=director.apply(state,{type:flag?'mute':'unmute'});
    state=result.state;
    return result.commands.length&&armed?report(backend.execute(result.commands)):
      Promise.resolve({ok:true});
  }
  function volume(bus,value){
    if(['master','music','sfx'].indexOf(bus)<0||
       !Number.isInteger(value)||value<0||value>100)
      return Promise.resolve({ok:false,reason:'invalid-volume'});
    var result=director.apply(state,{type:'volume',bus:bus,value:value});
    state=result.state;
    return result.commands.length&&armed?report(backend.execute(result.commands)):
      Promise.resolve({ok:true});
  }
  function suspend(){
    if(disposed||suspended)return;
    suspended=true;
    disable(); // Never restart audio automatically on foreground restoration.
  }
  function resume(){if(!disposed)suspended=false;}
  function dispose(){
    if(disposed)return;
    disposed=true;armed=false;backend.dispose();
    if(options.releaseFocus)options.releaseFocus();
  }
  function status(){
    return {available:enabledProfile,enabled:armed&&!suspended&&!disposed,
      suspended:suspended,muted:state.muted,
      volumes:{master:state.volumes.master,music:state.volumes.music,sfx:state.volumes.sfx},
      error:lastError,scene:currentView&&currentView.map,serial:requestSerial};
  }
  return Object.freeze({enable:enable,disable:disable,mute:mute,volume:volume,
    scene:scene,signal:signal,suspend:suspend,resume:resume,dispose:dispose,
    status:status});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeGameAudio;
