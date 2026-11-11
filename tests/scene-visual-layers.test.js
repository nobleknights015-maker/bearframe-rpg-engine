const test=require('node:test'),assert=require('node:assert/strict');
const validate=require('../framework/schema');
const engine=require('../framework/runtime');
const composer=require('../framework/scene');
const session=require('../framework/session');
const original=require('../fixtures/engine-project');
const clone=x=>JSON.parse(JSON.stringify(x));
function withLayers(){
  const project=clone(original);
  project.maps.hub.visualLayers=[
    {depth:'ground',cells:{'1,1':'grass','2,1':'grass','5,3':'grass'}},
    {depth:'canopy',cells:{'1,1':'roof','4,2':'roof'}}];
  const theme={tileSize:32,clearColor:'#101018',
    atlases:{terrain:{width:128,height:32},characters:{width:64,height:48}},
    tiles:{
      floor:{atlas:'terrain',x:0,y:0,w:32,h:32},
      wall:{atlas:'terrain',x:32,y:0,w:32,h:32},
      grass:{atlas:'terrain',x:64,y:0,w:32,h:32},
      roof:{atlas:'terrain',x:96,y:0,w:32,h:32}
    },
    sprites:{player:{ticksPerFrame:2,frames:[
      {atlas:'characters',x:0,y:0,w:32,h:48}]}}};
  return {project,theme};
}
test('optional scenery layers paint below and above character sprites',()=>{
  const {project,theme}=withLayers(),c=composer(project,theme);
  const e=engine(project),state=e.fresh('Layer test',13);
  const scene=c.compose(e.view(state),{width:96,height:96,tick:0});
  const ground=scene.commands.filter(cmd=>cmd.layer===0.5);
  const canopy=scene.commands.filter(cmd=>cmd.layer===2);
  const actor=scene.commands.findIndex(cmd=>cmd.actor==='player');
  assert.equal(ground.length,2,'camera clips offscreen scenery');
  assert.equal(canopy.length,1);
  assert.equal(ground[0].source.x,64);
  assert.equal(canopy[0].source.x,96);
  assert.ok(scene.commands.findIndex(cmd=>cmd.layer===0.5)<actor);
  assert.ok(scene.commands.findIndex(cmd=>cmd.layer===2)>actor);
  assert.equal(scene.commands.filter(cmd=>cmd.layer===0).length,9);
  assert.deepEqual(c.compose(e.view(state),{width:96,height:96,tick:0}),scene);
  assert.equal(e.serialize(state),e.serialize(e.fresh('Layer test',13)));
});
test('overlapping same-depth scenery obeys declared layer order in every host',()=>{
 const {project,theme}=withLayers();
 project.maps.hub.visualLayers.unshift({
   depth:'ground',cells:{'1,1':'roof'}});
 const game=engine(project),c=composer(project,theme);
 const draws=c.compose(game.view(game.fresh('Layer order',29)),{
   width:96,height:96,tick:0}).commands.filter(cmd=>
     cmd.layer===0.5&&cmd.world.x===1&&cmd.world.y===1);
 assert.deepEqual(draws.map(cmd=>cmd.source.x),[96,64],
   'higher-numbered ground layers must paint last even at identical x/y');
 assert.equal(draws.length,2);
});
test('base geometry and gameplay event triggers remain unchanged by visual layers',()=>{
 const {project,theme}=withLayers(),game=engine(project),s=game.fresh('Layer test',3);
 const p=game.step(s,{type:'move',dir:'right'});
 assert.equal(p.prompt.event,'supply');
 assert.equal(p.player.x,1,'event does not move the player');
 const c=composer(project,theme);
 const before=game.serialize(s);
 c.compose(game.view(s),{width:96,height:96});
 assert.equal(game.serialize(s),before);
 const invalid=clone(project);
 invalid.maps.hub.visualLayers[0].cells['0,0']='grass';
 assert.equal(validate(invalid),invalid,
   'visual scenery may cover walls without changing collision');
});
test('layer geometry and explicit tile IDs are validated before rendering',()=>{
 const {project,theme}=withLayers();
 function reject(edit,rx){let p=clone(project);edit(p);assert.throws(()=>validate(p),rx);}
 reject(p=>p.maps.hub.visualLayers[0].depth='unknown',/depth must/);
 reject(p=>p.maps.hub.visualLayers[0].cells['7,1']='grass',/out-of-bounds visual cell/);
 reject(p=>p.maps.hub.visualLayers[0].cells['1,5']='grass',/out-of-bounds visual cell/);
 reject(p=>p.maps.hub.visualLayers[0].cells['01,1']='grass',/out-of-bounds visual cell/);
 reject(p=>p.maps.hub.visualLayers[0].cells['1,1']='../bad',/stable id/);
 reject(p=>p.maps.hub.visualLayers={},/at most 6 layers/);
 reject(p=>p.maps.hub.visualLayers=Array.from({length:7},()=>({depth:'ground',cells:{}})),/at most 6 layers/);
 assert.throws(()=>composer(project,{...theme,tiles:{
   ...theme.tiles,grass:undefined}}),/Unknown visual tile grass/);
 const absent=clone(theme);delete absent.tiles.roof;
 assert.throws(()=>composer(project,absent),/Unknown visual tile roof/);
 const malformed=clone(theme);malformed.tiles.roof.w=31;
 assert.throws(()=>composer(project,malformed),/tile frames must match tileSize/);
});
test('world render layers and camera culling work at a 256x256 map boundary',()=>{
 const {project,theme}=withLayers();
 project.maps.large={name:'Large map',rows:Array(256).fill('.'.repeat(256)),
   exits:{},events:{},encounters:{},
   visualLayers:[
     {depth:'ground',cells:{'0,0':'grass','255,255':'grass'}},
     {depth:'canopy',cells:{'255,255':'roof'}}]};
 const e=engine(project),state=e.fresh('Large scene');
 state.player.map='large';state.player.x=255;state.player.y=255;
 assert.ok(e.validateState(state));
 const frame=composer(project,theme).compose(e.view(state),{width:96,height:96,tick:0});
 assert.equal(frame.commands.filter(c=>c.layer===0.5).length,1);
 assert.equal(frame.commands.filter(c=>c.layer===2).length,1);
 assert.ok(frame.commands.length<25,'tiles far outside viewport are culled');
});
test('existing unlayered projects and persisted saves remain byte compatible',()=>{
 const {project,theme}=withLayers();
 const data=Object.create(null),disk={
    read:k=>Object.prototype.hasOwnProperty.call(data,k)?data[k]:null,
    write:(k,v)=>{data[k]=v;return true;}};
 const old=session(original,disk,null,{slotPrefix:'bf:scene-compat-test'});
 assert.equal(old.start('Pilot',42).ok,true);
 const serialized=old.serialize();
 // A content-bound project needs explicit version management for new
 // visual layers, but unbound legacy sessions keep their unchanged journal.
 const visual=session(project,disk,theme,{slotPrefix:'bf:scene-compat-test'});
 assert.equal(visual.resume().ok,true);
 assert.equal(visual.serialize(),serialized);
 visual.compose({width:96,height:96,tick:0});
 assert.equal(visual.serialize(),serialized,'rendering may not write saves');
});

test('Android emulator must validate painter order in the installed offline WebView',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const route=read('android/test/RouteRunner.java');
 const ci=read('.github/workflows/engine-ci.yml');
 assert.match(route,/layerProject\.maps\.hub\.visualLayers/);
 assert.match(route,/createBearframeSceneComposer\(layerProject,layerTheme\)/);
 assert.match(route,/layerOrder=under>0&&actor>under&&over>actor/);
 assert.match(route,/getBoolean\("layerOrder"\)/);
 assert.match(route,/BearframeHost\.sceneryLayerAudit\(\)/);
 assert.match(route,/getInt\("alteredPixels"\)<=20/);
 assert.match(read('enginehost/boot.js'),/sceneryLayerAudit:sceneryLayerAudit/);
 assert.match(ci,/stage unified-landscape/);
});
