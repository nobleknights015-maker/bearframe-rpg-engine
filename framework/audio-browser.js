/* Bearframe Engine Kit: offline HTMLMediaElement audio backend.
 *
 * Consumes commands from framework/audio.js. This is a host adapter, not
 * a second game/audio state machine. Dependency injection permits deterministic
 * Node testing; in Android WebView the host supplies document.createElement.
 */
function createBearframeBrowserAudioBackend(createElement, config) {
  if(typeof createElement!=='function')
    throw new TypeError('Audio element factory required');
  config=config||{};
  var own=Object.prototype.hasOwnProperty;
  var prefix=config.assetPrefix===undefined?'':config.assetPrefix;
  if(typeof prefix!=='string'||
    (prefix!==''&&!/^(?:[A-Za-z0-9_-]+\/)+$/.test(prefix)))
    throw new TypeError('Local audio asset prefix required');
  if(config.maxSfxVoices!==undefined&&
    (!Number.isInteger(config.maxSfxVoices)||
     config.maxSfxVoices<1||config.maxSfxVoices>32))
    throw new TypeError('Invalid audio maxSfxVoices');
  var maxSfx=config.maxSfxVoices===undefined?8:config.maxSfxVoices;
  var liveMusic=null,voices=[],destroyed=false;
  var pending=Promise.resolve();
  var gain={music:1,sfx:1};
  var validPath=/^audio\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(?:ogg|wav|mp3)$/;
  function cleanup(media){
    try{media.pause();}catch(_){}
    try{media.currentTime=0;}catch(_){}
    try{media.removeAttribute('src');}catch(_){}
    try{media.load();}catch(_){}
  }
  function create(id,command){
    if(!validPath.test(command.path))
      throw new TypeError('Unsafe audio asset path '+id);
    var element=createElement('audio');
    if(!element||typeof element.play!=='function'||
       typeof element.pause!=='function')
      throw new TypeError('Invalid audio element for '+id);
    // Every native media property setter may fail (including src/loop/preload).
    // Retire partially initialized elements before reporting the failure.
    try{
      element.preload='auto';
      element.src=prefix+command.path;
      element.loop=!!command.loop;
      element.volume=Math.min(1,Math.max(0,command.gain/100));
    }catch(error){cleanup(element);throw error;}
    return {id:id,element:element};
  }
  function safePlay(entry){
    try{
      return Promise.resolve(entry.element.play()).then(
        function(){return {ok:true};},
        function(error){return {ok:false,reason:'play-rejected',
          message:String(error&&error.message||error)};});
    }catch(error){
      return Promise.resolve({ok:false,reason:'play-threw',
        message:String(error&&error.message||error)});
    }
  }
  function dropOldest(){
    while(voices.length>=maxSfx){
      var old=voices.shift();
      cleanup(old.element);
    }
  }
  function stopMusic(){
    if(liveMusic){cleanup(liveMusic.element);liveMusic=null;}
  }
  function removeVoice(entry){
    var i=voices.indexOf(entry);
    if(i>=0)voices.splice(i,1);
    cleanup(entry.element);
  }
  function applyOne(cmd){
    if(!cmd||typeof cmd!=='object'||typeof cmd.type!=='string')
      return Promise.resolve({ok:false,reason:'invalid-command'});
    if(cmd.type==='gain'){
      if((cmd.bus!=='music'&&cmd.bus!=='sfx')||
        typeof cmd.gain!=='number'||!isFinite(cmd.gain)||
        cmd.gain<0||cmd.gain>100)
        return Promise.resolve({ok:false,reason:'invalid-gain'});
      // A detached or failed native media element can throw on volume writes.
      // Keep the serialized command queue alive and report the adapter failure.
      var nextGain=cmd.gain/100;
      try{
        if(cmd.bus==='music'&&liveMusic)
          liveMusic.element.volume=nextGain;
        if(cmd.bus==='sfx'){
          // A dead native voice must not prevent surviving voices from
          // receiving the new bus gain. Retire failed elements safely.
          var failed=[];
          voices.slice().forEach(function(entry){
            try{entry.element.volume=nextGain;}
            catch(error){failed.push({entry:entry,error:error});}
          });
          if(failed.length){
            failed.forEach(function(item){removeVoice(item.entry);});
            return Promise.resolve({ok:false,reason:'gain-threw',
              message:String(failed[0].error&&failed[0].error.message||failed[0].error)});
          }
        }
      }catch(error){
        // A music element whose native gain setter failed is no longer
        // trustworthy. Retire it so resume cannot reuse a broken track.
        if(cmd.bus==='music')stopMusic();
        return Promise.resolve({ok:false,reason:'gain-threw',
          message:String(error&&error.message||error)});
      }
      gain[cmd.bus]=nextGain;
      return Promise.resolve({ok:true});
    }
    if(cmd.type==='stop'){
      if(cmd.bus!=='music')return Promise.resolve({ok:false,reason:'invalid-bus'});
      stopMusic();
      return Promise.resolve({ok:true});
    }
    if(cmd.type==='pause'||cmd.type==='resume'){
      if(cmd.bus!=='music'||!liveMusic||liveMusic.id!==cmd.id)
        return Promise.resolve({ok:false,reason:'no-music'});
      if(cmd.type==='pause'){
        try{liveMusic.element.pause();return Promise.resolve({ok:true});}
        catch(error){return Promise.resolve({ok:false,reason:'pause-threw',
          message:String(error&&error.message||error)});}
      }
      return safePlay(liveMusic);
    }
    if(cmd.type==='play'){
      if(!/^[a-z][a-z0-9_-]{0,63}$/.test(cmd.id||'')||
        (cmd.bus!=='music'&&cmd.bus!=='sfx')||
        typeof cmd.gain!=='number'||!isFinite(cmd.gain)||
        cmd.gain<0||cmd.gain>100)
        return Promise.resolve({ok:false,reason:'invalid-play'});
      var entry;
      try{entry=create(cmd.id,cmd);}
      catch(error){return Promise.resolve({ok:false,reason:'invalid-asset',
        message:String(error&&error.message||error)});}
      // The director's play gain already combines master and bus volume.
      // Do not multiply it by the last gain event a second time.
      try{entry.element.volume=cmd.gain/100;}
      catch(error){cleanup(entry.element);
        return Promise.resolve({ok:false,reason:'gain-threw',
          message:String(error&&error.message||error)});}
      if(cmd.bus==='music'){
        stopMusic();
        liveMusic=entry;
        return safePlay(entry).then(function(result){
          if(!result.ok&&liveMusic===entry)stopMusic();
          return result;
        });
      }
      dropOldest();
      voices.push(entry);
      try{entry.element.onended=function(){removeVoice(entry);};}
      catch(error){
        removeVoice(entry);
        return Promise.resolve({ok:false,reason:'ended-handler-threw',
          message:String(error&&error.message||error)});
      }
      return safePlay(entry).then(function(result){
        if(!result.ok)removeVoice(entry);
        return result;
      });
    }
    return Promise.resolve({ok:false,reason:'unknown-command'});
  }
  function execute(commands){
    if(destroyed)return Promise.resolve([{ok:false,reason:'destroyed'}]);
    if(!Array.isArray(commands)||commands.length>64)
      return Promise.reject(new TypeError('Audio command batch must contain at most 64 commands'));
    // Commands are sequential; a stop must happen before its replacement play.
    // Serialize separate batches as well as commands inside each batch.
    // Without this, simultaneous UI and lifecycle calls can reorder stop/play.
    // Snapshot queued commands now, not when an earlier asynchronous play settles.
    // A caller must not be able to rewrite an already accepted local asset path.
    var queued=commands.map(function(cmd){
      if(!cmd||typeof cmd!=='object')return cmd;
      return {type:cmd.type,bus:cmd.bus,id:cmd.id,path:cmd.path,
        loop:cmd.loop,gain:cmd.gain};
    });
    var work=pending.then(function(){
      return queued.reduce(function(p,cmd){
        return p.then(function(results){
          if(destroyed){results.push({ok:false,reason:'destroyed'});return results;}
          return applyOne(cmd).then(function(item){results.push(item);return results;});
        });
      },Promise.resolve([]));
    });
    pending=work.then(function(){},function(){});
    return work;
  }
  function status(){
    return {destroyed:destroyed,music:liveMusic?liveMusic.id:null,
      activeSfx:voices.length,maxSfxVoices:maxSfx};
  }
  function dispose(){
    if(destroyed)return;
    destroyed=true;stopMusic();
    while(voices.length)cleanup(voices.shift().element);
  }
  return Object.freeze({execute:execute,status:status,dispose:dispose});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeBrowserAudioBackend;
