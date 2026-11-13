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
    var defaultTheme={tileSize:32,clearColor:'#101018',
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
    // The complete original library stays registered; scene images alone are decoded.
    // This visual dependency override is independent of the durable save journal.
    var artProfile=(typeof BEARFRAME_OWNER_ART_PROFILE==='object'&&
      BEARFRAME_OWNER_ART_PROFILE&&BEARFRAME_OWNER_ART_PROFILE.version===1)?
      BEARFRAME_OWNER_ART_PROFILE:null;
    var theme=artProfile?artProfile.theme:defaultTheme;
    var renderManifest=artProfile?artProfile.manifest:BEARFRAME_HOST_ASSETS;
    var requiredImages=artProfile?artProfile.requiredImages:['terrain','characters'];
    validateBearframeAssets(renderManifest);
    if(!Array.isArray(requiredImages)||requiredImages.length<1||
       requiredImages.length>32||requiredImages.some(function(id){
         return typeof id!=='string'||!Object.prototype.hasOwnProperty.call(renderManifest.assets,id);
       }))throw new TypeError('Invalid scene art dependencies');
    var assets=createBearframeAssetCache(renderManifest,function(descriptor,id){
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
    function sceneReady(){
      return requiredImages.every(function(id){return !!assets.get(id);});
    }
    function sceneImages(){
      var images={};
      requiredImages.forEach(function(id){
        var image=assets.get(id);
        if(!image)throw new Error('Missing scene image '+id);
        images[id]=image;
      });
      return images;
    }
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
    // A validated, data-only authored project can reuse this entire engine
    // without modifying simulation or UI JavaScript. Invalid content must
    // fail closed before opening any save slot.
    var authoredContent=BEARFRAME_CONTENT_PROFILE;
    if(authoredContent!==null){
      if(!authoredContent||authoredContent.version!==1||
         !authoredContent.project||!authoredContent.project.partyCombat||
         !authoredContent.project.partyCombat.progression)
        throw new TypeError('Invalid authored engine content profile');
      validateEngineProject(authoredContent.project);
    }
    var partyWorldProject=authoredContent?
      authoredContent.project:FRAMEWORK_PARTY_WORLD_FIXTURE;
    var partyWorldSaveNamespace=authoredContent?
      'bf:'+partyWorldProject.id+':v2:runtime':undefined;
    var partyWorld=createBearframePartyWorldHost(storage,partyWorldProject,theme,
      {slotPrefix:partyWorldSaveNamespace});
    // A separate two-slot settings journal must never share any key with
    // the canonical RPG session, archive or engine diagnostic save.
    var userSettings=createBearframeUiPreferences(storage,partyWorldProject.id);
    var savedSettings=userSettings.snapshot();
    // Gameplay audio is opt-in and never part of the simulation/save journal.
    // The soundtrack catalog is compiled from an explicitly installed
    // local sound pack. Empty profiles remain silent and safe.
    var gameAudio=createBearframeGameAudio(
      BEARFRAME_GAME_AUDIO_PROFILE,
      function(tag){return document.createElement(tag);},
      {project:partyWorldProject,
       requestFocus:function(){return !androidFocus||androidFocus.request()===true;},
       releaseFocus:releaseFocus});
    ['master','music','sfx'].forEach(function(bus){
      gameAudio.volume(bus,savedSettings.volumes[bus]);
    });
    gameAudio.mute(savedSettings.muted);
    gameAudio.scene(null,partyWorld.view(),null);
    window.addEventListener('pagehide',function(){gameAudio.dispose();});
    window.addEventListener('blur',function(){gameAudio.suspend();});
    window.addEventListener('focus',function(){gameAudio.resume();});
    document.addEventListener('visibilitychange',function(){
      if(document.hidden)gameAudio.suspend();
      else gameAudio.resume();
    });
    var freeExploration=!!(partyWorldProject.movement&&
      partyWorldProject.movement.mode==='free');
    var motionTween=createBearframeMotionTween(110);
    var partyWorldStatus=document.getElementById('party-world-status');
    var partyWorldSurface=document.getElementById('party-world-surface');
    var partyWorldSceneReady=false,partyWorldClock=null;
    var partyWorldPainter=createBearframeScenePainter(partyWorldSurface);
    // Ported Engine v1 frame-work budget: read-only telemetry, NOT reported FPS.
    var sceneBudget=createBearframePerformanceBudget({profile:'balanced',windowSize:120});
    var sceneBudgetSamples=0;
    // A WebView Canvas 2D context can be restored with identical commands
    // but an empty bitmap. Force the next paint rather than cache the loss.
    partyWorldSurface.addEventListener('contextlost',function(){
      partyWorldPainter.invalidate();
      partyWorldSceneReady=false;syncPresentationClock();
    });
    partyWorldSurface.addEventListener('contextrestored',function(){
      partyWorldPainter.invalidate();renderPartyWorld();
    });
    // Presentation-only step window; never stored in the durable journal.
    var lastDrawnPlayer=null,playerWalkUntilTick=-1;
    var lastRoom=null;
    var roomTransition=document.getElementById('party-world-room-transition');
    function announceRoom(view){
      if(!view||lastRoom===view.map)return;
      var changed=lastRoom!==null;
      lastRoom=view.map;
      // Initial load establishes the room without pretending the player
      // entered via a door; later transitions are presentation-only.
      if(!changed||!roomTransition)return;
      roomTransition.textContent=view.mapName||view.map;
      roomTransition.classList.remove('room-transition-playing');
      void roomTransition.offsetWidth;
      roomTransition.classList.add('room-transition-playing');
    }
    function partyWorldInteractive(){
      return partyWorldSceneReady&&!restoring&&
        sceneReady();
    }
    var partyWorldSaveStatus=document.getElementById('party-world-save-status');
    var partyWorldButtons=Array.from(document.querySelectorAll('[data-party-world-dir]'));
    partyWorldButtons.forEach(function(button){
      if(button.getAttribute('data-party-world-dir').indexOf('-')>=0)
        button.hidden=!(partyWorldProject.movement&&
          partyWorldProject.movement.mode==='free'&&
          partyWorldProject.movement.directions===8);
    });
    var partyWorldScreens=createBearframeScreenNavigator(
      document.getElementById('party-world-navigation'),{
        world:document.getElementById('pw-screen-world'),
        party:document.getElementById('pw-screen-party'),
        save:document.getElementById('pw-screen-save')
      },function(){syncPresentationClock();});
    var jrpgMenu=createBearframeJRPGMenu(
      document.getElementById('jrpg-menu'),
      document.getElementById('jrpg-menu-open'),{
        view:function(){return partyWorld.view();},project:partyWorldProject,
        dispatch:function(command){return partyWorldAction(command);},
        verifySave:function(){return partyWorld.verifySave();},
        audio:gameAudio,preferences:userSettings,
        onVisibility:function(){syncPresentationClock();renderPartyWorld();}
      });
    function performPartyMovement(dir){
      if(!partyWorldInteractive())
        return {ok:false,reason:'assets-restoring'};
      var before=partyWorld.view(),result=partyWorld.navigate(dir);
      if(result.ok){
        gameAudio.scene(before,partyWorld.view(),'move');
        if(!freeExploration||!motionTween.capture(
          before,partyWorld.view(),performance.now()))motionTween.reset();
      }
      if(result.ok||result.reason==='no-change')renderPartyWorld();
      else partyWorldStatus.textContent='Party movement refused: '+result.reason;
      return result;
    }
    var partyWorldInput=createBearframeWorldInput(
      partyWorldScreens,function(){return partyWorld.view();},
      performPartyMovement,{
        world:document.getElementById('pw-screen-world'),
        party:document.getElementById('pw-screen-party'),
        save:document.getElementById('pw-screen-save')
      },jrpgMenu);
    function partyWorldAction(command){
      if(!partyWorldInteractive()){
        partyWorldStatus.textContent='Party scene unavailable; controls are paused.';
        return {ok:false,reason:'assets-restoring'};
      }
      var before=partyWorld.view(),result=partyWorld.dispatch(command);
      if(result.ok){
        gameAudio.scene(before,partyWorld.view(),command.type);
        renderPartyWorld();
      }
      else partyWorldStatus.textContent='Party action refused: '+result.reason;
      return result;
    }
    var partyWorldPanels=createBearframeRuntimePanels(
      document.getElementById('party-world-events'),
      document.getElementById('party-world-inventory'),
      partyWorldStatus,partyWorldProject,
      function(){return partyWorld.view();},partyWorldAction);
    var partyWorldBattlePanel=createBearframePartyCommandPanel(
      document.getElementById('party-world-battle'),{
        battle:function(){return partyWorld.battle();},
        submit:function(orders){
          if(!partyWorldInteractive())return {ok:false,reason:'assets-restoring'};
          var before=partyWorld.view(),result=partyWorld.submit(orders);
          if(result.ok)gameAudio.scene(before,partyWorld.view(),'party-round');
          return result;
        }
      },partyWorldProject.partyCombat.skills,function(outcome){
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
    // Tick is a purely visual clock, independent of all persisted revisions.
    function paintPartyWorldFrame(tick,deterministic,allowCachedAudit){
      if(!sceneReady()||restoring)
        throw new Error('Scene atlas loading or recovery in progress');
      var workStarted=performance.now();
      var current=partyWorld.view();
      if(current){
        var pos=current.freePosition||current;
        if(lastDrawnPlayer&&current.map===lastDrawnPlayer.map&&
           (pos.x!==lastDrawnPlayer.x||pos.y!==lastDrawnPlayer.y))
          playerWalkUntilTick=tick+(freeExploration?9:5);
        lastDrawnPlayer={map:current.map,x:pos.x,y:pos.y};
      }
      var options={
        width:partyWorldSurface.width,height:partyWorldSurface.height,tick:tick,
        playerDirection:partyWorld.facing(),
        playerMoving:tick<playerWalkUntilTick
      };
      if(freeExploration&&!deterministic&&current&&current.freePosition){
        var shown=motionTween.sample(performance.now());
        if(shown){
          options.playerDrawPosition=shown;
          options.cameraTarget={
            x:Math.max(0,Math.min(current.rows[0].length-1,shown.x)),
            y:Math.max(0,Math.min(current.rows.length-1,shown.y))
          };
        }
      }
      var frame=partyWorld.compose(options);
      partyWorldPainter.paint(frame,sceneImages(),!!deterministic&&!allowCachedAudit);
      // Record only successful scene composition plus draw/skip CPU cost.
      // The requestAnimationFrame clock and compositor FPS are independent.
      sceneBudget.recordFrame(Math.max(0,performance.now()-workStarted));
      if((++sceneBudgetSamples%60)===0){
        var visibleActors=0;
        frame.commands.forEach(function(command){
          if(command.actor)visibleActors++;
        });
        sceneBudget.assess({loadedAssets:assets.snapshot().loaded.length,
          visibleSprites:visibleActors,visibleTiles:frame.visibleTiles});
      }
    }
    function syncPresentationClock(){
      if(!partyWorldClock)return;
      if(!document.hidden&&!restoring&&partyWorldSceneReady&&
         partyWorldScreens.current()==='world'&&!jrpgMenu.isOpen())partyWorldClock.start();
      else partyWorldClock.stop();
    }
    // Installed-Android comparison needs the *same* presentation phase
    // before/after atlas eviction. The live RAF clock otherwise legitimately
    // changes pixels even when the durable world state is unchanged.
    function renderVisualTickForAudit(tick){
      if(!Number.isInteger(tick)||tick<0||tick>2147483647)
        return {ok:false,reason:'invalid-tick'};
      if(!partyWorldInteractive())return {ok:false,reason:'scene-not-ready'};
      partyWorldClock.stop();
      paintPartyWorldFrame(tick,true);
      return {ok:true,tick:tick,revision:partyWorld.view().sequence};
    }
    // Installed WebView acceptance: two identical deterministic scene paints
    // must not execute two Canvas draws or advance a durable RPG revision.
    function renderCacheAudit(){
      if(!partyWorldInteractive())return {ok:false,reason:'scene-not-ready'};
      partyWorldClock.stop();
      var before=partyWorld.view(),tick=partyWorldClock.tick();
      paintPartyWorldFrame(tick,true);
      var first=partyWorldPainter.snapshot();
      paintPartyWorldFrame(tick,true,true);
      var second=partyWorldPainter.snapshot();
      var after=partyWorld.view(),saved=partyWorld.verifySave();
      syncPresentationClock();
      return {ok:second.skipped===first.skipped+1&&
        second.paints===first.paints&&saved.ok&&
        before.sequence===after.sequence,
        beforeRevision:before.sequence,afterRevision:after.sequence,
        skippedBefore:first.skipped,skippedAfter:second.skipped,
        drawsBefore:first.paints,drawsAfter:second.paints,
        averageDrawMs:second.averageDrawMs,maxDrawMs:second.maxDrawMs};
    }
    function renderPartyWorld(){
      var snap=partyWorld.snapshot(),v=snap.view;
      if(!v){
        partyWorldSceneReady=false;
        syncPresentationClock();
        partyWorldStatus.textContent='Party world unavailable: '+snap.error;
        partyWorldButtons.forEach(function(b){b.disabled=true;});
        return;
      }
      announceRoom(v);
      var sceneError=null;
      try {
        paintPartyWorldFrame(partyWorldClock?partyWorldClock.tick():0);
        partyWorldSceneReady=true;
      }catch(error){
        partyWorldSceneReady=false;
        sceneError=error.message;
      }
      if((v.prompt||v.partyBattle||v.battle)&&jrpgMenu.isOpen())jrpgMenu.close();
      var locked=!!v.prompt||!!v.partyBattle||!!v.battle||!partyWorldSceneReady;
      var menuButton=document.getElementById('jrpg-menu-open');
      menuButton.disabled=locked;
      document.getElementById('jrpg-world-location').textContent=v.mapName||v.map;
      document.getElementById('engine-landscape-stage').setAttribute('data-phase',
        v.prompt?'event':v.partyBattle||v.battle?'battle':'explore');
      partyWorldStatus.textContent=sceneError?
        'Party scene paused: '+sceneError+' · saved revision '+v.sequence:
        (v.prompt?'Conversation · ':v.partyBattle||v.battle?'Battle · ':'')+
        (v.message||'Exploring '+(v.mapName||v.map));
      partyWorldButtons.forEach(function(button){button.disabled=locked||jrpgMenu.isOpen();});
      partyWorldPanels.render();partyWorldBattlePanel.render();
      jrpgMenu.refresh();
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
      syncPresentationClock();
    }
    // Renderer-only health check for Android instrumentation and the
    // diagnostic screen. Proves that *visible event actors* produce real
    // pixels, rather than merely existing as map/event metadata.
    // Uses the same Engine v1-derived scene command path as gameplay.
    function sceneVisibilityAudit(){
      if(!partyWorldInteractive())return {ok:false,reason:'scene-not-ready'};
      var before=partyWorld.view(),width=partyWorldSurface.width,
        height=partyWorldSurface.height,tick=before.sequence%100;
      var options={width:width,height:height,tick:tick};
      var scene=partyWorld.compose(options);
      var actors=scene.commands.filter(function(c){
        return typeof c.actor==='string'&&c.actor.indexOf('event:')===0;
      });
      var without=partyWorld.compose({
        width:width,height:height,tick:tick,actors:[]
      });
      var full=document.createElement('canvas'),base=document.createElement('canvas');
      full.width=base.width=width;full.height=base.height=height;
      var sheets=sceneImages();
      drawBearframeSceneCanvas(full,scene,sheets);
      drawBearframeSceneCanvas(base,without,sheets);
      var painted=full.getContext('2d').getImageData(0,0,width,height).data;
      var empty=base.getContext('2d').getImageData(0,0,width,height).data;
      var differentPixels=0;
      for(var p=0;p<painted.length;p+=4){
        if(painted[p]!==empty[p]||painted[p+1]!==empty[p+1]||
           painted[p+2]!==empty[p+2]||painted[p+3]!==empty[p+3])
          differentPixels++;
      }
      var after=partyWorld.view();
      return {ok:actors.length>0&&differentPixels>0&&
        before.sequence===after.sequence,
        eventActors:actors.length,differentPixels:differentPixels,
        revisionBefore:before.sequence,revisionAfter:after.sequence,
        actorIds:actors.map(function(c){return c.actor;}),
        canvasWidth:width,canvasHeight:height};
    }
    // Diagnostic-only Canvas pixel comparison for scenery layering.
    // The original world journal is never touched by this audit.
    function sceneryLayerAudit(){
      if(!partyWorldInteractive())return {ok:false,reason:'scene-not-ready'};
      var before=partyWorld.view(),
        project=JSON.parse(JSON.stringify(FRAMEWORK_PARTY_FIXTURE));
      project.maps.hub.visualLayers=[
        {depth:'ground',cells:{'1,2':'wall'}},
        {depth:'canopy',cells:{'2,1':'wall'}}
      ];
      var opts={width:partyWorldSurface.width,height:partyWorldSurface.height,
        tick:before.sequence%100,actors:[]};
      var baseline=createBearframeSceneComposer(FRAMEWORK_PARTY_FIXTURE,theme)
        .compose(before,opts);
      var layered=createBearframeSceneComposer(project,theme)
        .compose(before,opts);
      var base=document.createElement('canvas'),enhanced=document.createElement('canvas');
      base.width=enhanced.width=opts.width;
      base.height=enhanced.height=opts.height;
      var sheets=sceneImages();
      drawBearframeSceneCanvas(base,baseline,sheets);
      drawBearframeSceneCanvas(enhanced,layered,sheets);
      var one=base.getContext('2d').getImageData(0,0,opts.width,opts.height).data,
        two=enhanced.getContext('2d').getImageData(0,0,opts.width,opts.height).data,
        pixels=0;
      for(var i=0;i<one.length;i+=4)
        if(one[i]!==two[i]||one[i+1]!==two[i+1]||
          one[i+2]!==two[i+2]||one[i+3]!==two[i+3])pixels++;
      var under=layered.commands.findIndex(function(c){return c.layer===0.5;}),
        actor=layered.commands.findIndex(function(c){return c.actor==='player';}),
        over=layered.commands.findIndex(function(c){return c.layer===2;});
      var after=partyWorld.view();
      return {ok:under>=0&&under<actor&&over>actor&&pixels>20&&
        before.sequence===after.sequence,
        alteredPixels:pixels,ground:under,player:actor,canopy:over,
        beforeRevision:before.sequence,afterRevision:after.sequence};
    }
    // Installed WebView proof: animation must alter real pixels, without
    // touching the engine's single durable journal or mutating project data.
    function animatedTileAudit(){
      if(!partyWorldInteractive())return {ok:false,reason:'scene-not-ready'};
      var before=partyWorld.view(),animated=JSON.parse(JSON.stringify(theme));
      animated.tiles.floor={ticksPerFrame:1,frames:[
        {atlas:'terrain',x:0,y:0,w:32,h:32},
        {atlas:'terrain',x:32,y:0,w:32,h:32}
      ]};
      var composer=createBearframeSceneComposer(FRAMEWORK_PARTY_FIXTURE,animated);
      var opts={width:partyWorldSurface.width,
        height:partyWorldSurface.height,actors:[]};
      function packet(tick){
        return composer.compose(before,{width:opts.width,height:opts.height,
          tick:tick,actors:[]});
      }
      var first=packet(0),second=packet(1),start=null,end=null;
      first.commands.forEach(function(cmd){
        if(cmd.layer===0&&cmd.world.x===1&&cmd.world.y===1)start=cmd.source.x;
      });
      second.commands.forEach(function(cmd){
        if(cmd.layer===0&&cmd.world.x===1&&cmd.world.y===1)end=cmd.source.x;
      });
      var canvasA=document.createElement('canvas'),canvasB=document.createElement('canvas');
      canvasA.width=canvasB.width=opts.width;
      canvasA.height=canvasB.height=opts.height;
      var sheets=sceneImages();
      drawBearframeSceneCanvas(canvasA,first,sheets);
      drawBearframeSceneCanvas(canvasB,second,sheets);
      var a=canvasA.getContext('2d').getImageData(0,0,opts.width,opts.height).data,
        b=canvasB.getContext('2d').getImageData(0,0,opts.width,opts.height).data,
        changed=0;
      for(var i=0;i<a.length;i+=4)
        if(a[i]!==b[i]||a[i+1]!==b[i+1]||
           a[i+2]!==b[i+2]||a[i+3]!==b[i+3])changed++;
      var after=partyWorld.view();
      return {ok:start===0&&end===32&&changed>20&&
        before.sequence===after.sequence,
        firstFrame:start,secondFrame:end,changedPixels:changed,
        revisionBefore:before.sequence,revisionAfter:after.sequence};
    }
    partyWorldClock=createBearframePresentationClock({
      intervalMs:freeExploration?16:50,
      paint:function(tick){
        if(document.hidden||restoring||!partyWorldSceneReady||
           partyWorldScreens.current()!=='world')return false;
        paintPartyWorldFrame(tick);
        return true;
      },
      onError:function(error){
        partyWorldSceneReady=false;
        partyWorldStatus.textContent='Visual animation paused: '+error.message;
      }
    });
    // Stop idle redraws offscreen and after Activity lifecycle transitions.
    document.addEventListener('visibilitychange',function(){
      if(document.hidden)partyWorldClock.stop();
      else{renderPartyWorld();syncPresentationClock();}
    });
    window.addEventListener('pagehide',function(){partyWorldClock.stop();});
    window.addEventListener('blur',function(){partyWorldClock.stop();});
    window.addEventListener('focus',function(){syncPresentationClock();});
    var partyWorldTouchPad=createBearframeTouchPad(partyWorldButtons,
      performPartyMovement);
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
      if(!sceneReady())throw new Error('Required scene atlases are not loaded');
      drawBearframeSceneCanvas(surface,frame,sceneImages());
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
      // A replaced or evicted atlas must never reuse the preceding frame.
      partyWorldPainter.invalidate();
      var trimmed=assets.trimTo(target);
      trimCount++;
      if(!sceneReady()){
        if(!restoring){
          status.textContent='Restoring offline scene assets';
          retryAssets.disabled=true;retryAssets.hidden=true;
          restoring=assets.preload(requiredImages).then(function(){
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
      if(restoring||!sceneReady())
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
        atlasSource:'packaged-png',ownerArtActive:!!artProfile,
        scenePaint:partyWorldPainter.snapshot(),
        renderWork:sceneBudget.snapshot(),
        renderer:surface.width+'x'+surface.height};
    }
    assets.preload(requiredImages).then(function(){
    window.BearframeHost=Object.freeze({
      snapshot:snapshot,
      snapshotJson:function(){return JSON.stringify(snapshot());},
      memoryPressure:memoryPressure,
      verifySave:verifySaved,
      party:partyProbe,
      partyWorld:partyWorld,
      sceneVisibilityAudit:sceneVisibilityAudit,
      sceneryLayerAudit:sceneryLayerAudit,
      animatedTileAudit:animatedTileAudit,
      renderVisualTickForAudit:renderVisualTickForAudit,
      renderCacheAudit:renderCacheAudit,
      presentationClock:partyWorldClock,
      scenePainter:partyWorldPainter,
      renderBudget:sceneBudget,
      partyWorldScreens:partyWorldScreens,
      jrpgMenu:jrpgMenu,
      gameAudio:gameAudio,
      userSettings:userSettings,
      input:function(action){return partyWorldInput.handle(action);},
      navigate:function(dir){
        if(['up','down','left','right'].indexOf(dir)<0)return {ok:false,reason:'invalid-direction'};
        return act({type:'move',dir:dir});
      },
      suspend:function(){
        partyWorldClock.stop();audioProbe.suspend();
        gameAudio.suspend();return snapshot();
      },
      resume:function(){
        audioProbe.resume();gameAudio.resume();
        if(restoring)return snapshot();
        show();renderPartyWorld();syncPresentationClock();
        return snapshot();
      }
    });
    var diagnosticTouchPad=createBearframeTouchPad(
      Array.from(document.querySelectorAll('[data-dir]')),function(direction){
        return window.BearframeHost.navigate(direction);
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