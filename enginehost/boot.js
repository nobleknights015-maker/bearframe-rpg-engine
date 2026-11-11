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
  // Engine v1-derived viewport now owns the actual full-screen landscape shell.
  var landscape=createBearframeLandscapeLayout(document.getElementById('engine-landscape-stage'));
  window.BearframeLandscape=landscape;
  var retryAssets=document.getElementById('runtime-assets-retry');
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
      // The diagnostic sheet currently has only two tiny original test
      // frames. Event markers deliberately reuse a known valid frame until
      // real NPC atlases are supplied by the game's asset manifest.
      sprites:{
        player:{ticksPerFrame:5,frames:[
          {atlas:'characters',x:0,y:0,w:32,h:48},
          {atlas:'characters',x:32,y:0,w:32,h:48}
        ]},
        eventMarker:{ticksPerFrame:1,frames:[
          {atlas:'characters',x:32,y:0,w:32,h:48}
        ]}
      },
      eventSprites:{supply:'eventMarker',mechanic:'eventMarker',scout:'eventMarker'}
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
    if(vault){
      // Keep the historical runtime confined to a user-confirmed, isolated
      // save session. It deliberately uses the frozen ORIGINAL rules.
      attachBearframeLegacyCompatibilityUI({
        source:{read:function(key){
          return key==='expedition'?window.BearframeNative.readLegacyExpedition():null;
        }},
        storage:storage,
        original:buildEngine({WORLD:WORLD,FOES:FOES,TEXT:TEXT,ACTIONS:ACTIONS}),
        world:{WORLD:WORLD,ACTIONS:ACTIONS}
      });
    }else{
      ['legacy-compat-preview','legacy-compat-confirm','legacy-compat-resume'].forEach(function(id){
        document.getElementById(id).disabled=true;
      });
      document.getElementById('legacy-compat-status').textContent=
        'Historical compatibility requires the local Android source bridge.';
    }
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
    // End-to-end opt-in v2 world: visible navigation, scripted choices,
    // shared gear, party turns and XP all use a single separate native journal.
    // The old launcher, v1 diagnostics and historical saves remain untouched.
    var partyWorld=createBearframePartyWorldHost(storage,FRAMEWORK_PARTY_WORLD_FIXTURE,theme);
    var partyWorldStatus=document.getElementById('party-world-status');
    var partyWorldSurface=document.getElementById('party-world-surface');
    var partyWorldSceneReady=false;
    function partyWorldInteractive(){
      return partyWorldSceneReady&&!restoring&&
        !!assets.get('terrain')&&!!assets.get('characters');
    }
    var partyWorldSaveStatus=document.getElementById('party-world-save-status');
    var partyWorldButtons=Array.from(document.querySelectorAll('[data-party-world-dir]'));
    var partyWorldScreens=createBearframeScreenNavigator(
      document.getElementById('party-world-navigation'),{
        world:document.getElementById('pw-screen-world'),
        party:document.getElementById('pw-screen-party'),
        save:document.getElementById('pw-screen-save')
      });
    var partyWorldInput=createBearframeWorldInput(
      partyWorldScreens,function(){return partyWorld.view();},
      function(dir){
        if(!partyWorldInteractive())
          return {ok:false,reason:'assets-restoring'};
        var result=partyWorld.navigate(dir);
        if(result.ok)renderPartyWorld();
        else partyWorldStatus.textContent='Party movement refused: '+result.reason;
        return result;
      },{
        world:document.getElementById('pw-screen-world'),
        party:document.getElementById('pw-screen-party'),
        save:document.getElementById('pw-screen-save')
      });
    function partyWorldAction(command){
      if(!partyWorldInteractive()){
        partyWorldStatus.textContent='Party scene unavailable; controls are paused.';
        return {ok:false,reason:'assets-restoring'};
      }
      var result=partyWorld.dispatch(command);
      if(result.ok)renderPartyWorld();
      else partyWorldStatus.textContent='Party action refused: '+result.reason;
      return result;
    }
    var partyWorldPanels=createBearframeRuntimePanels(
      document.getElementById('party-world-events'),
      document.getElementById('party-world-inventory'),
      partyWorldStatus,FRAMEWORK_PARTY_WORLD_FIXTURE,
      function(){return partyWorld.view();},partyWorldAction);
    var partyWorldBattlePanel=createBearframePartyCommandPanel(
      document.getElementById('party-world-battle'),{
        battle:function(){return partyWorld.battle();},
        submit:function(orders){
          return partyWorldInteractive()?partyWorld.submit(orders):
            {ok:false,reason:'assets-restoring'};
        }
      },FRAMEWORK_PARTY_WORLD_FIXTURE.partyCombat.skills,function(outcome){
        if(outcome.ok)renderPartyWorld();
        else partyWorldStatus.textContent='Party order refused: '+outcome.reason;
        // The host owns repaint/paging after a successful turn; on failure
        // retain the existing controls and page rather than rebuilding.
        return true;
      });
    var landscapePages=createBearframeLandscapePager({
      events:document.getElementById('party-world-events'),
      inventory:document.getElementById('party-world-inventory'),
      battle:document.getElementById('party-world-battle')
    });
    var previousPartyPhase=null;
    function renderPartyWorld(){
      var snap=partyWorld.snapshot(),v=snap.view;
      if(!v){
        partyWorldSceneReady=false;
        partyWorldStatus.textContent='Party world unavailable: '+snap.error;
        partyWorldButtons.forEach(function(b){b.disabled=true;});
        return;
      }
      var terrain=assets.get('terrain'),characters=assets.get('characters');
      var sceneError=null;
      try {
        if(!terrain||!characters||restoring)
          throw new Error('Scene atlas loading or recovery in progress');
        // Compose directly from the same canonical v2 state that controls
        // movement, inventory and party combat. Rendering never commits data.
        var frame=partyWorld.compose({
          width:partyWorldSurface.width,height:partyWorldSurface.height,
          tick:v.sequence%100
        });
        drawBearframeSceneCanvas(partyWorldSurface,frame,
          {terrain:terrain,characters:characters});
        partyWorldSceneReady=true;
      }catch(error){
        partyWorldSceneReady=false;
        sceneError=error.message;
      }
      var locked=!!v.prompt||!!v.partyBattle||!!v.battle||!partyWorldSceneReady;
      document.getElementById('engine-landscape-stage').setAttribute('data-phase',
        v.prompt?'event':v.partyBattle||v.battle?'battle':'explore');
      partyWorldStatus.textContent=sceneError?
        'Party scene paused: '+sceneError+' · saved revision '+v.sequence:
        'v2 '+v.mapName+' ('+v.x+','+v.y+
        ') · revision '+v.sequence+' · '+(v.prompt?'Event choice':
        v.partyBattle?'Party combat':'Explore')+' · '+v.message;
      partyWorldButtons.forEach(function(button){button.disabled=locked;});
      partyWorldPanels.render();partyWorldBattlePanel.render();
      var phase=v.prompt?'event':v.partyBattle||v.battle?'battle':'explore';
      landscapePages.all(previousPartyPhase!==phase);
      previousPartyPhase=phase;
      if(!partyWorldSceneReady){
        // Do not allow a stale scene or evicted atlas to accept touch actions.
        Array.from(document.querySelectorAll(
          '#party-world-events button,#party-world-inventory button,#party-world-battle button'
        )).forEach(function(button){button.disabled=true;});
      }
      partyWorldSaveStatus.textContent=snap.journal.latestSequence===v.sequence?
        'Party world auto-saved · revision '+v.sequence:
        'Party world has not verified durable storage.';
      partyWorldScreens.sync(v.prompt?'event':
        v.partyBattle||v.battle?'battle':'explore',partyWorldSceneReady);
    }
    partyWorldButtons.forEach(function(button){
      button.addEventListener('click',function(){
        var direction=button.getAttribute('data-party-world-dir');
        var result=partyWorldInteractive()?partyWorld.navigate(direction):
          {ok:false,reason:'assets-restoring'};
        if(result.ok)renderPartyWorld();
        else partyWorldStatus.textContent='Party movement refused: '+result.reason;
      });
    });
    document.getElementById('party-world-verify').addEventListener('click',function(){
      var result=partyWorld.verifySave();
      partyWorldSaveStatus.textContent=result.ok?
        'Verified party world checkpoint revision '+result.revision:
        'Party world save verification failed: '+result.reason;
    });
    renderPartyWorld();
    var load=engine.resume();
    if(!load.ok&&load.reason==='no-save')load=engine.start('Engine host',8735);
    if(!load.ok)throw new Error('Safe engine startup blocked: '+load.reason);
    var saveStatus=document.getElementById('runtime-save-status');
    var phaseStatus=document.getElementById('runtime-phase');
    var actionStatus=document.getElementById('runtime-action-status');
    var directional=Array.from(document.querySelectorAll('[data-dir]'));
    var previousRuntimeMode=null;
    var runtimeCombat=createBearframeRuntimeCombatPanel(
      document.getElementById('runtime-combat-controls'),
      FRAMEWORK_FIXTURE,
      function(){return engine.snapshot().view;},
      function(command){return act(command);}
    );
    function verifySaved(){
      var result=engine.verifySave();
      saveStatus.textContent=result.ok?
        'Verified: checkpoint revision '+result.revision+
        ' matches durable storage. Close and reopen the app to resume automatically.':
        'Save verification failed: '+result.reason+'. Keep this app open.';
      return result;
    }
    document.getElementById('runtime-save-verify').addEventListener('click',verifySaved);
    var runtimePanels=createBearframeRuntimePanels(
      document.getElementById('runtime-event-controls'),
      document.getElementById('runtime-inventory-controls'),
      document.getElementById('runtime-action-status'),
      FRAMEWORK_FIXTURE,
      function(){return engine.snapshot().view;},
      function(command){return act(command);}
    );
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
      runtimePanels.render();
      runtimeCombat.render();
      var blocked=!!v.prompt||!!v.battle||!!v.partyBattle;
      directional.forEach(function(button){button.disabled=blocked;});
      phaseStatus.textContent=v.prompt?
        'A conversation needs your choice. Select an option above; movement is paused.':
        v.battle?'An encounter has begun. Choose a combat action above; movement is paused.':
        v.partyBattle?'Party encounter active. Use party combat controls.':
        'Exploring — use the directional buttons to move.';
      // On a small phone the player can be looking at the D-pad when an
      // event/encounter opens above it. Move focus only on phase entry.
      // Never activate a choice or mutate the journal as a side effect.
      var currentMode=v.prompt?'event':v.battle?'combat':
        v.partyBattle?'party-combat':'explore';
      if(currentMode!==previousRuntimeMode){
        previousRuntimeMode=currentMode;
        var nextAction=currentMode==='event'?
          document.querySelector('#runtime-event-controls [data-event-choice]'):
          currentMode==='combat'?
          document.querySelector('#runtime-combat-controls [data-runtime-combat]'):null;
        if(nextAction){
          nextAction.focus();
          if(typeof nextAction.scrollIntoView==='function')
            nextAction.scrollIntoView({block:'nearest'});
        }
      }
      actionStatus.textContent=v.message;
      saveStatus.textContent=snap.journal.latestSequence===v.sequence?
        'Auto-saved · revision '+v.sequence+'. Progress resumes when this app reopens.':
        'Save mismatch: displayed revision has not been confirmed on disk.';
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
          retryAssets.disabled=true;retryAssets.hidden=true;
          restoring=assets.preload(['terrain','characters']).then(function(){
            restoring=null;recoveryCount++;show();renderPartyWorld();return true;
          },function(error){
            restoring=null;recoveryFailures++;
            status.textContent='Scene restoration failed: '+error.message;
            retryAssets.disabled=false;retryAssets.hidden=false;
            metrics.textContent='Saved state preserved; retry after resources recover.';
            renderPartyWorld();
            return false;
          });
        }
      }
      renderPartyWorld();
      return {ok:true,evicted:trimmed.evicted,restoring:!!restoring};
    }
    retryAssets.addEventListener('click',function(){
      retryAssets.disabled=true;retryAssets.hidden=true;
      memoryPressure(80);
    });
    function act(command) {
      if(restoring||!assets.get('terrain')||!assets.get('characters'))
        return {ok:false,reason:'assets-restoring'};
      var result=engine.dispatch(command);
      if(!result.ok){
        var view=engine.snapshot().view;
        var explanation=result.reason==='no-change'?
          view&&view.prompt?'Choose a conversation response above to continue.':
          view&&view.battle?'Combat is active. Use the battle buttons above.':
          view&&view.partyBattle?'A party battle is active. Use the party controls.':
          'No movement: a wall, blocked path, or unavailable action.':
          'Action not saved: '+result.reason+'. Progress was not advanced.';
        actionStatus.textContent=explanation;
      }else show();
      return result;
    }
    function snapshot(){
      var snap=engine.snapshot(),v=snap.view;
      return {ready:!!snap.started,error:snap.error,project:snap.project,
        engineVersion:snap.engineVersion,sequence:v?v.sequence:null,
        map:v?v.map:null,x:v?v.x:null,y:v?v.y:null,
        savedRevision:snap.journal.latestSequence,
        mode:v?(v.prompt?'event':v.battle?'combat':v.partyBattle?'party-battle':'explore'):null,
        saveVerified:v?snap.journal.latestSequence===v.sequence&&snap.journal.validSlots>0:false,
        inventory:v?v.inventory:null,weapon:v?v.weapon:null,quests:v?v.quests:null,
        prompt:v?v.prompt:null,
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
      verifySave:verifySaved,
      party:partyProbe,
      partyWorld:partyWorld,
      partyWorldScreens:partyWorldScreens,
      input:function(action){return partyWorldInput.handle(action);},
      navigate:function(dir){
        if(['up','down','left','right'].indexOf(dir)<0)return {ok:false,reason:'invalid-direction'};
        return act({type:'move',dir:dir});
      },
      suspend:function(){audioProbe.suspend();return snapshot();},
      resume:function(){
        audioProbe.resume();
        if(restoring)return snapshot();
        show();renderPartyWorld();
        return snapshot();
      }
    });
    Array.from(document.querySelectorAll('[data-dir]')).forEach(function(button){
      button.addEventListener('click',function(){
        window.BearframeHost.navigate(button.getAttribute('data-dir'));
      });
    });
    show();renderPartyWorld();
    }).catch(function(error){
      status.textContent='Asset loading failed: '+error.message;
      retryAssets.disabled=false;retryAssets.hidden=false;
      retryAssets.addEventListener('click',function(){location.reload();});
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