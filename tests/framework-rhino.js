/* This file runs in Mozilla Rhino, not Node. */
function ensure(ok,label){if(!ok)throw new Error('Framework/Rhino: '+label);}
var engine=createBearframeEngine(FRAMEWORK_FIXTURE);
var state=engine.fresh('Rhino',91);
ensure(engine.validateState(state),'starting state');
var cache={},store={
 read:function(k){return Object.prototype.hasOwnProperty.call(cache,k)?cache[k]:null;},
 write:function(k,v){cache[k]=v;return true;}
};
var journal=createBearframeSaveSlots(engine,store);
ensure(journal.save(state).ok,'durable initial save');
var prompt=engine.step(state,{type:'move',dir:'right'});
ensure(prompt.prompt&&prompt.prompt.event==='supply','event interaction');
var gear=engine.step(prompt,{type:'choose',id:'collect'});
ensure(gear.inventory.blade===1&&gear.quests.survey===0,'scripted effects');
ensure(journal.save(gear).ok,'second save');
ensure(engine.restore(engine.serialize(gear)).sequence===gear.sequence,'state round trip');
ensure(journal.load().sequence===gear.sequence,'journal recovery');
var move=engine.step(gear,{type:'move',dir:'right'});
ensure(move.player.x===2,'completed event becomes walkable');
var fight=engine.step(move,{type:'move',dir:'right'});
ensure(fight.battle&&fight.battle.foe==='crawler','scripted encounter');
var turn=engine.step(fight,{type:'combat',id:'pulse'});
ensure(turn.battle&&turn.battle.turn===2,'combat round');
ensure(journal.save(turn).ok,'turn persisted');
ensure(journal.load().battle.turn===2,'turn recovered');
print('PASS portable JRPG framework and crash-resistant save journal under Rhino');

var art={
 tileSize:32,clearColor:'#101018',
 atlases:{tiles:{width:128,height:128},actors:{width:128,height:128}},
 tiles:{floor:{atlas:'tiles',x:0,y:0,w:32,h:32},wall:{atlas:'tiles',x:32,y:0,w:32,h:32}},
 sprites:{player:{ticksPerFrame:4,frames:[
  {atlas:'actors',x:0,y:0,w:32,h:48},
  {atlas:'actors',x:32,y:0,w:32,h:48}
 ]}}
};
var composer=createBearframeSceneComposer(FRAMEWORK_FIXTURE,art);
var frame=composer.compose(engine.view(turn),{width:96,height:96,tick:4});
ensure(frame.commands.length>2,'scene rendered');
ensure(frame.commands[0].type==='clear','scene clear');
var playerDraw=null;
for(var i=0;i<frame.commands.length;i++)if(frame.commands[i].actor==='player')playerDraw=frame.commands[i];
ensure(playerDraw&&playerDraw.source.x===32,'animated sprite frame selected');
print('PASS portable scene camera and sprite commands under Rhino');

var audio=createBearframeAudioDirector({
 theme:{type:'music',path:'audio/music/theme.ogg',loop:true},
 step:{type:'sfx',path:'audio/sfx/step.wav'}
});
var audioStart=audio.fresh();
var song=audio.apply(audioStart,{type:'music',id:'theme'});
ensure(song.state.music==='theme'&&song.commands[0].type==='play','music started');
var audioPaused=audio.apply(song.state,{type:'pause'});
ensure(audioPaused.state.paused===true,'audio paused');
var audioResumed=audio.apply(audioPaused.state,{type:'resume'});
ensure(audioResumed.commands[0].type==='resume','audio resumed');
print('PASS portable audio command scheduler under Rhino');

var skills={strike:{kind:'damage',power:4,cost:0,element:'physical'},
 guard:{kind:'guard',power:0,cost:0,element:'physical'}};
var partyCombat=createBearframePartyCombat(skills);
var hero={id:'hero',name:'Hero',hp:30,maxHp:30,mp:2,maxMp:2,attack:7,defense:3,
 speed:5,skills:['strike','guard'],resistances:{}};
var enemy={id:'enemy',name:'Enemy',hp:25,maxHp:25,mp:0,maxMp:0,attack:3,defense:1,
 speed:3,skills:['strike'],resistances:{}};
var battle=partyCombat.begin([hero],[enemy],33);
var played=partyCombat.round(battle,[{actor:'hero',skill:'strike',target:'enemy'}]);
ensure(played.turn===2&&played.foes[0].hp<25,'party combat round');
ensure(partyCombat.restore(partyCombat.serialize(played)).turn===2,'party combat restore');
print('PASS multi-character combat engine under Rhino');

var v1Viewport=createBearframeViewport(320,240);
var vp=v1Viewport.fit(393,830,{top:24,bottom:16});
var mapped=vp.screenToLogical(vp.logicalToScreen(70,90).x,vp.logicalToScreen(70,90).y);
ensure(Math.abs(mapped.x-70)<0.001&&Math.abs(mapped.y-90)<0.001,'Engine v1 touch mapping port');
var v1Budget=createBearframePerformanceBudget({profile:'conservative',windowSize:10});
v1Budget.recordFrame(20);
ensure(v1Budget.health().healthy===true,'Engine v1 performance monitor');
ensure(v1Budget.assess({visibleTiles:1100}).level==='moderate','Engine v1 tile pressure');
print('PASS Engine v1 viewport and performance systems under Rhino');

var v1Windows=createBearframeWindowLayout({viewportWidth:320,viewportHeight:240});
var msgBox=v1Windows.messageWindow({lines:3,hasFace:true,name:'Observer'});
var menuBox=v1Windows.choiceWindow({choices:['Continue','Back'],messageRect:msgBox.rect});
ensure(msgBox.face.width>0&&menuBox.items.length===2,'ported Engine v1 windows');
ensure(menuBox.rect.x+menuBox.rect.width<=320,'ported window viewport fit');
print('PASS Engine v1 classic JRPG windows under Rhino');

var v1Migrate=createBearframeSaveMigrator({
 schemaVersion:2,
 migrations:{1:function(payload){payload.state.maxHp=payload.state.hp;return payload;}},
 validate:function(s){return s.maxHp===s.hp;}
});
var beforeSave={schemaVersion:1,project:'bearframe',state:{hp:42}};
var afterSave=v1Migrate.migrate(beforeSave);
ensure(afterSave.schemaVersion===2&&afterSave.state.maxHp===42,'ported save migration');
ensure(beforeSave.state.maxHp===undefined,'save migrations do not mutate inputs');
print('PASS Engine v1 save migrations under Rhino');

var unifiedMemory={};
var unifiedStorage={
  read:function(k){return Object.prototype.hasOwnProperty.call(unifiedMemory,k)?unifiedMemory[k]:null;},
  write:function(k,v){unifiedMemory[k]=v;return true;}
};
var unified=createBearframeSession(FRAMEWORK_FIXTURE,unifiedStorage,art,{slotPrefix:'bf:rhino:v1:unified'});
ensure(unified.start('Shared core',79).ok,'unified Rhino session starts');
ensure(unified.dispatch({type:'move',dir:'down'}).ok,'unified Rhino move');
ensure(unified.snapshot().view.y===2,'unified Rhino moved to row 2');
var unifiedReload=createBearframeSession(FRAMEWORK_FIXTURE,unifiedStorage,art,{slotPrefix:'bf:rhino:v1:unified'});
ensure(unifiedReload.resume().ok,'unified Rhino session resumes');
ensure(unifiedReload.snapshot().view.sequence===1,'unified Rhino retained committed revision');
ensure(unifiedReload.compose({width:96,height:96,tick:0}).commands.length>3,'unified Rhino composed scene');
print('PASS unified session under Rhino using the same core as WebView');
