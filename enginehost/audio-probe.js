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
  var backend=backendFactory(createElement,{maxSfxVoices:2});
  var state=director.fresh();
  var disposed=false;
  function play(){
    if(disposed)return Promise.resolve({ok:false,reason:'disposed'});
    var next=director.apply(state,{type:'sfx',id:'diagnostic'});
    state=next.state;
    return backend.execute(next.commands).then(function(results){
      return results[0]||{ok:false,reason:'no-command'};
    });
  }
  function dispose(){disposed=true;backend.dispose();}
  return Object.freeze({play:play,dispose:dispose,status:backend.status});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeAudioProbe;
