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
    function atlas(width,height,paint) {
      var canvas=document.createElement('canvas');
      canvas.width=width;canvas.height=height;
      var ctx=canvas.getContext('2d');
      if(!ctx)throw new Error('Browser Canvas unavailable');
      paint(ctx);return canvas;
    }
    var terrain=atlas(64,32,function(ctx){
      ctx.fillStyle='#344457';ctx.fillRect(0,0,32,32);
      ctx.fillStyle='#46667a';ctx.fillRect(0,0,32,4);
      ctx.fillStyle='#172435';ctx.fillRect(32,0,32,32);
      ctx.fillStyle='#354c64';ctx.fillRect(34,2,28,5);
    });
    var characters=atlas(64,48,function(ctx){
      ctx.fillStyle='#e4e6f2';ctx.fillRect(6,9,20,35);
      ctx.fillStyle='#c5b7e9';ctx.fillRect(8,4,16,10);
      ctx.fillStyle='#7f87d9';ctx.fillRect(7,18,18,5);
      ctx.fillStyle='#e4e6f2';ctx.fillRect(38,9,20,35);
      ctx.fillStyle='#c5b7e9';ctx.fillRect(40,4,16,10);
      ctx.fillStyle='#7f87d9';ctx.fillRect(39,18,18,5);
    });
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
        renderer:surface.width+'x'+surface.height};
    }
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
  }catch(error) {
    status.textContent='Engine diagnostics failed: '+error.message;
    metrics.textContent='The previous saved state is preserved. See the test log.';
    window.BearframeHost=Object.freeze({
      snapshotJson:function(){return JSON.stringify({ready:false,error:error.message});}
    });
  }
}());