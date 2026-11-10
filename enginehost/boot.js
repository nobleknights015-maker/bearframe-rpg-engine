/* Offline unified runtime diagnostic host.
 * The same framework/session.js runs unchanged in Android WebView, a browser,
 * Node tests, and the Rhino compatibility harness.
 * This is engineering verification only; no new game content is added.
 */
(function () {
  'use strict';
  var status=document.getElementById('status');
  var metrics=document.getElementById('metrics');
  var surface=document.getElementById('surface');
  function text(id,value){document.getElementById(id).textContent=String(value);}
  try {
    var theme={tileSize:32,clearColor:'#101018',
      atlases:{terrain:{width:64,height:32},characters:{width:64,height:48}},
      tiles:{
        floor:{atlas:'terrain',x:0,y:0,w:32,h:32},
        wall:{atlas:'terrain',x:32,y:0,w:32,h:32}
      },
      sprites:{player:{ticksPerFrame:5,frames:[
        {atlas:'characters',x:0,y:0,w:32,h:48},
        {atlas:'characters',x:32,y:0,w:32,h:48}
      ]}}
    };
    var assets=createBearframeAssetCache(BEARFRAME_HOST_ASSETS,function(descriptor,id){
      return new Promise(function(resolve,reject){
        var image=new Image();
        image.onload=function(){resolve(image);};
        image.onerror=function(){reject(new Error('Missing or corrupt packaged atlas '+id));};
        // The deployed WebView serves only local packaged files from its own origin.
        // Browsers opened from the source tree use the same relative asset path.
        image.src=(location.protocol==='file:'?'./':'/')+
          (location.protocol==='file:'?descriptor.path.replace(/^enginehost\//,''):descriptor.path);
      });
    },{maxEntries:32,maxMemoryBytes:16777216});
    var storage=window.BearframeNative&&
      typeof window.BearframeNative.read==='function'&&
      typeof window.BearframeNative.write==='function'
      ?{
         read:function(key){return window.BearframeNative.read(key);},
         write:function(key,value){return window.BearframeNative.write(key,value)===true;}
       }
      :{
         read:function(key){try{return localStorage.getItem(key);}catch(e){return null;}},
         write:function(key,value){
           try{localStorage.setItem(key,value);return localStorage.getItem(key)===value;}
           catch(e){return false;}
         }
       };
    var engine=createBearframeSession(FRAMEWORK_FIXTURE,storage,theme,
      {slotPrefix:'bf:framework-test:v1:diagnostics'});
    var load=engine.resume();
    if(!load.ok&&load.reason==='no-save')load=engine.start('Engine host',8735);
    if(!load.ok)throw new Error('Safe engine startup blocked: '+load.reason);
    function show(){
      var snap=engine.snapshot(),v=snap.view;
      if(!v)throw new Error('Engine state unavailable');
      var frame=engine.compose({width:224,height:160,tick:v.sequence%100});
      var terrain=assets.get('terrain'),characters=assets.get('characters');
      if(!terrain||!characters)throw new Error('Required scene atlases are not loaded');
      drawBearframeSceneCanvas(surface,frame,{terrain:terrain,characters:characters});
      status.textContent='Unified runtime ready · '+(window.BearframeNative?'Android WebView':'Browser');
      metrics.textContent='Map '+v.mapName+' · Pos '+v.x+','+v.y+
        ' · Revision '+v.sequence+' · '+snap.journal.validSlots+' validated save slot(s)';
      return snap;
    }
    function act(command) {
      var result=engine.dispatch(command);
      if(!result.ok&&result.reason!=='no-change'){
        status.textContent='State unchanged: '+result.reason;
      }else show();
      return result;
    }
    function snapshot(){
      var snap=engine.snapshot(),v=snap.view;
      return {ready:!!snap.started,error:snap.error,project:snap.project,
        engineVersion:snap.engineVersion,sequence:v?v.sequence:null,
        map:v?v.map:null,x:v?v.x:null,y:v?v.y:null,
        savedRevision:snap.journal.latestSequence,
        validSlots:snap.journal.validSlots,conflict:snap.journal.conflict,
        assetsLoaded:assets.snapshot().loaded.length,atlasSource:'packaged-png',
        renderer:surface.width+'x'+surface.height};
    }
    assets.preload().then(function(){
    window.BearframeHost=Object.freeze({
      snapshot:snapshot,
      snapshotJson:function(){return JSON.stringify(snapshot());},
      navigate:function(dir){
        if(['up','down','left','right'].indexOf(dir)<0)return {ok:false,reason:'invalid-direction'};
        return act({type:'move',dir:dir});
      },
      suspend:function(){return snapshot();},
      resume:function(){return show()&&snapshot();}
    });
    Array.from(document.querySelectorAll('[data-dir]')).forEach(function(button){
      button.addEventListener('click',function(){
        window.BearframeHost.navigate(button.getAttribute('data-dir'));
      });
    });
    show();
    }).catch(function(error){
      status.textContent='Asset loading failed: '+error.message;
      metrics.textContent='Existing save preserved; no partial scene was presented.';
      window.BearframeHost=Object.freeze({
        snapshotJson:function(){return JSON.stringify({ready:false,error:error.message});}
      });
    });
  }catch(error) {
    status.textContent='Engine diagnostics failed: '+error.message;
    metrics.textContent='The previous saved state is preserved. See the test log.';
    window.BearframeHost=Object.freeze({
      snapshotJson:function(){return JSON.stringify({ready:false,error:error.message});}
    });
  }
}());