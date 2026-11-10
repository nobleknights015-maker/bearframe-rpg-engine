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
  // Audio is a host-only diagnostic. Never touch the simulation journal.
  var audioProbe=createBearframeAudioProbe(function(tag){return document.createElement(tag);});
  var audioStatus=document.getElementById('audio-status');
  var androidFocus=window.BearframeAudioFocus&&
    typeof window.BearframeAudioFocus.request==='function'?
    window.BearframeAudioFocus:null;
  function releaseFocus(){if(androidFocus)androidFocus.abandon();}
  document.getElementById('audio-probe').addEventListener('click',function(){
    // Invoke play synchronously from the gesture callback to satisfy browser
    // media activation; the backend reports policy/decoder failures explicitly.
    if(androidFocus&&!androidFocus.request()){
      audioStatus.textContent='Android audio focus unavailable; playback not started';
      return;
    }
    audioProbe.play().then(function(result){
      if(!result.ok)releaseFocus();
      audioStatus.textContent=result.ok?'Offline WAV playback started':
        'Offline audio unavailable: '+result.reason;
    },function(error){
      releaseFocus();
      audioStatus.textContent='Offline audio failed: '+error.message;
    });
  });
  window.addEventListener('pagehide',function(){audioProbe.dispose();releaseFocus();});
  window.addEventListener('blur',function(){audioProbe.suspend();releaseFocus();});
  window.addEventListener('focus',function(){audioProbe.resume();});
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){audioProbe.suspend();releaseFocus();}
    else audioProbe.resume();
  });
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
    // Historical save preservation is separate from the active simulation.
    // NEVER inspect, archive, or write automatically during startup.
    var vault=null,archiveStatus=document.getElementById('legacy-archive-status');
    var inspectButton=document.getElementById('legacy-preview');
    var confirmButton=document.getElementById('legacy-confirm');
    var exportButton=document.getElementById('legacy-export');
    var restoreButton=document.getElementById('legacy-restore');
    var archiveExport=window.BearframeArchiveExport&&
      typeof window.BearframeArchiveExport.begin==='function'?
      window.BearframeArchiveExport:null;
    exportButton.disabled=true;
    restoreButton.disabled=!archiveExport||
      typeof archiveExport.beginRestore!=='function'||
      !archiveExport.canRestoreIntoEmptySource();
    restoreButton.addEventListener('click',function(){
      if(!archiveExport||!archiveExport.beginRestore())
        archiveStatus.textContent='Restore refused: original save already exists or picker unavailable.';
      else
        archiveStatus.textContent='Select a previously exported historical JSON backup.';
    });
    exportButton.addEventListener('click',function(){
      if(!archiveExport||!archiveExport.begin()){
        archiveStatus.textContent='Verified archive unavailable for export.';
      }else{
        archiveStatus.textContent='Choose a location to save the historical JSON backup.';
      }
    });
    if(window.BearframeNative &&
       typeof window.BearframeNative.readLegacyExpedition==='function'){
      vault=createBearframeLegacyArchive({read:function(key){
        return key==='expedition'?window.BearframeNative.readLegacyExpedition():null;
      }},storage);
      inspectButton.addEventListener('click',function(){
        var inspection=vault.inspect();
        confirmButton.disabled=!inspection.ok;
        archiveStatus.textContent=inspection.ok?
          'Validated '+inspection.summary.name+' at '+inspection.summary.area+
          ' ('+inspection.summary.x+','+inspection.summary.y+
          '); confirm to archive separately. Original save unchanged.':
          'Archive inspection refused: '+inspection.reason;
      });
      confirmButton.addEventListener('click',function(){
        confirmButton.disabled=true; // One explicit consent per staged inspection.
        var result=vault.confirm();
        archiveStatus.textContent=result.ok?
          'Exact historical save archived and read back. Original save unchanged.':
          'Archive refused: '+result.reason;
        exportButton.disabled=!(result.ok&&archiveExport);
      });
      var existing=vault.audit();
      if(existing.ok){
        archiveStatus.textContent='Existing historical backup verified; original save preserved.';
        inspectButton.disabled=true;
        exportButton.disabled=!archiveExport;
      }
    }else{
      inspectButton.disabled=true;
      archiveStatus.textContent='Historical source bridge unavailable in this host.';
    }
    window.BearframeLegacyVault=vault;
    var engine=createBearframeSession(FRAMEWORK_FIXTURE,storage,theme,
      {slotPrefix:'bf:framework-test:v1:diagnostics'});
    // Opt-in v2 combat runs through the same canonical engine/session API,
    // but in its own synthetic project journal. No other save key is changed.
    var partyProbe=createBearframePartyProbe(storage);
    var partyStatus=document.getElementById('party-status');
    var panel=createBearframePartyCommandPanel(
      document.getElementById('party-controls'),partyProbe,
      FRAMEWORK_PARTY_FIXTURE.partyCombat.skills,function(result){
        describeParty();
        if(!result.ok)partyStatus.textContent='Party order rejected: '+result.reason;
      });
    function describeParty(){
      var p=partyProbe.snapshot();
      partyStatus.textContent=!p.ready?'Party diagnostic unavailable: '+p.error:
        p.phase==='active'?'Battle active · Target HP '+p.targetHp+
          ' · Revision '+p.sequence:
        'Party diagnostic revision '+p.sequence+' · No active battle';
      return p;
    }
    document.getElementById('party-start').addEventListener('click',function(){
      var r=partyProbe.begin();describeParty();panel.render();
      if(!r.ok)partyStatus.textContent='Party start blocked: '+r.reason;
    });
    document.getElementById('party-round').addEventListener('click',function(){
      var r=partyProbe.round();describeParty();panel.render();
      if(!r.ok)partyStatus.textContent='Party round blocked: '+r.reason;
    });
    describeParty();panel.render();
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
    // A native trim callback may evict decoded atlases. Never draw an incomplete
    // scene or advance gameplay while the required render dependencies reload.
    var restoring=null,trimCount=0,recoveryCount=0,recoveryFailures=0;
    function memoryPressure(level){
      if(!Number.isInteger(level)||level<0||level>100)
        return {ok:false,reason:'invalid-level'};
      if(restoring)return {ok:true,evicted:0,restoring:true};
      var target=level>=80?0:level>=40?4194304:8388608;
      var trimmed=assets.trimTo(target);
      trimCount++;
      if(!assets.get('terrain')||!assets.get('characters')){
        if(!restoring){
          status.textContent='Restoring offline scene assets';
          restoring=assets.preload(['terrain','characters']).then(function(){
            restoring=null;recoveryCount++;show();return true;
          },function(error){
            restoring=null;recoveryFailures++;
            status.textContent='Scene restoration failed: '+error.message;
            metrics.textContent='Saved state preserved; retry after resources recover.';
            return false;
          });
        }
      }
      return {ok:true,evicted:trimmed.evicted,restoring:!!restoring};
    }
    function act(command) {
      if(restoring||!assets.get('terrain')||!assets.get('characters'))
        return {ok:false,reason:'assets-restoring'};
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
        assetsLoaded:assets.snapshot().loaded.length,
        trimCount:trimCount,recoveryCount:recoveryCount,
        recoveryFailures:recoveryFailures,restoring:!!restoring,
        atlasSource:'packaged-png',
        renderer:surface.width+'x'+surface.height};
    }
    assets.preload().then(function(){
    window.BearframeHost=Object.freeze({
      snapshot:snapshot,
      snapshotJson:function(){return JSON.stringify(snapshot());},
      memoryPressure:memoryPressure,
      party:partyProbe,
      navigate:function(dir){
        if(['up','down','left','right'].indexOf(dir)<0)return {ok:false,reason:'invalid-direction'};
        return act({type:'move',dir:dir});
      },
      suspend:function(){audioProbe.suspend();return snapshot();},
      resume:function(){
        audioProbe.resume();
        if(restoring)return snapshot();
        return show()&&snapshot();
      }
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