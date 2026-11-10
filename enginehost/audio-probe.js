/* Isolated offline audio acceptance probe: no game state or saves touched.
 * Playback is started only from a real user gesture (browser autoplay policy).
 */
function createBearframeAudioProbe(createElement){
  var directorFactory=(typeof module!=='undefined'&&module.exports)
    ?require('../framework/audio.js'):createBearframeAudioDirector;
  var backendFactory=(typeof module!=='undefined'&&module.exports)
    ?require('../framework/audio-browser.js'):createBearframeBrowserAudioBackend;
  var director=directorFactory({
    diagnostic:{type:'sfx',path:'audio/diagnostics/silence.wav'}
  });
  function newBackend(){return backendFactory(createElement,{maxSfxVoices:2});}
  var backend=newBackend();
  var suspended=false;
  var state=director.fresh();
  var disposed=false;
  function play(){
    if(disposed)return Promise.resolve({ok:false,reason:'disposed'});
    if(suspended)return Promise.resolve({ok:false,reason:'suspended'});
    var next=director.apply(state,{type:'sfx',id:'diagnostic'});
    state=next.state;
    return backend.execute(next.commands).then(function(results){
      return results[0]||{ok:false,reason:'no-command'};
    });
  }
  function suspend(){
    if(disposed||suspended)return;
    suspended=true;
    backend.dispose(); // stop active audio; never autoplay on foreground return
  }
  function resume(){
    if(disposed||!suspended)return;
    backend=newBackend();
    suspended=false;
  }
  function dispose(){
    if(disposed)return;
    disposed=true;
    backend.dispose();
  }
  function status(){
    var current=backend.status();
    return {disposed:disposed,suspended:suspended,
      activeSfx:current.activeSfx,music:current.music};
  }
  return Object.freeze({play:play,suspend:suspend,resume:resume,
    dispose:dispose,status:status});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeAudioProbe;
