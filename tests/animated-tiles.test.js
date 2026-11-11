const test=require('node:test'),assert=require('node:assert/strict');
const createEngine=require('../framework/runtime');
const createScene=require('../framework/scene');
const original=require('../fixtures/engine-project');
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const project=clone(original);
 project.maps.hub.visualLayers=[
  {depth:'ground',cells:{'1,1':'spark'}},
  {depth:'canopy',cells:{'1,1':'spark'}}];
 const theme={tileSize:32,clearColor:'#101018',
  atlases:{terrain:{width:160,height:32},characters:{width:64,height:48}},
  tiles:{
   floor:{ticksPerFrame:3,frames:[
    {atlas:'terrain',x:0,y:0,w:32,h:32},
    {atlas:'terrain',x:32,y:0,w:32,h:32}]},
   wall:{atlas:'terrain',x:64,y:0,w:32,h:32},
   spark:{ticksPerFrame:2,frames:[
    {atlas:'terrain',x:96,y:0,w:32,h:32},
    {atlas:'terrain',x:128,y:0,w:32,h:32}]}
  },
  sprites:{player:{ticksPerFrame:5,frames:[
   {atlas:'characters',x:0,y:0,w:32,h:48}]}}
 };
 return {project,theme};
}
function tiles(frame,layer,x,y){
 return frame.commands.filter(c=>c.layer===layer&&c.world&&
   c.world.x===x&&c.world.y===y);
}
test('animated terrain is deterministic and keeps scenery below/above actors',()=>{
 const {project,theme}=fixture();
 const e=createEngine(project),s=e.fresh('Visual',73),c=createScene(project,theme);
 const initial=e.serialize(s),themeBefore=JSON.stringify(theme);
 const v=e.view(s),frame=tick=>c.compose(v,{width:96,height:96,tick});
 const zero=frame(0),two=frame(2),three=frame(3),four=frame(4),six=frame(6);
 assert.equal(tiles(zero,0,1,1)[0].source.x,0);
 assert.equal(tiles(two,0,1,1)[0].source.x,0);
 assert.equal(tiles(three,0,1,1)[0].source.x,32);
 assert.equal(tiles(six,0,1,1)[0].source.x,0);
 assert.equal(tiles(zero,0.5,1,1)[0].source.x,96);
 assert.equal(tiles(two,0.5,1,1)[0].source.x,128);
 assert.equal(tiles(four,2,1,1)[0].source.x,96);
 const actor=two.commands.findIndex(x=>x.actor==='player');
 assert.ok(two.commands.findIndex(x=>x.layer===0.5)<actor);
 assert.ok(two.commands.findIndex(x=>x.layer===2)>actor);
 assert.deepEqual(frame(2),two);
 assert.equal(e.serialize(s),initial,'animation cannot modify the game journal');
 assert.equal(JSON.stringify(theme),themeBefore);
});
test('legacy static tile projects and old sprite commands remain unchanged',()=>{
 const {project,theme}=fixture();
 delete project.maps.hub.visualLayers;
 theme.tiles.floor=theme.tiles.floor.frames[0];
 theme.tiles.spark=theme.tiles.spark.frames[0];
 const e=createEngine(project),state=e.fresh('Old'),scene=createScene(project,theme);
 const a=scene.compose(e.view(state),{width:96,height:96,tick:0});
 const b=scene.compose(e.view(state),{width:96,height:96,tick:50});
 assert.equal(tiles(a,0,1,1)[0].source.x,0);
 assert.deepEqual(tiles(a,0,1,1),tiles(b,0,1,1));
 assert.equal(a.commands.filter(c=>c.layer===0.5||c.layer===2).length,0);
});
test('animated tile schema rejects invalid animation before presentation',()=>{
 const cases=[
 [t=>t.tiles.floor.frames=[],/Invalid animated tile/],
 [t=>t.tiles.floor.frames=new Array(129).fill(t.tiles.floor.frames[0]),/Invalid animated tile/],
 [t=>t.tiles.floor.frames=null,/Invalid animated tile/],
 [t=>t.tiles.floor.ticksPerFrame=0,/Invalid animated tile/],
 [t=>t.tiles.floor.ticksPerFrame=1.5,/Invalid animated tile/],
 [t=>t.tiles.floor.frames[0].x=150,/outside atlas/],
 [t=>t.tiles.floor.frames[1].h=31,/tile frames must match/],
 [t=>t.tiles.floor.frames[1].atlas='missing',/missing atlas/],
 [t=>t.tiles.floor.atlas='terrain',/cannot include static frame/],
 [t=>t.tiles.spark.ticksPerFrame=1001,/Invalid animated tile/]
 ];
 for(const [edit,reason] of cases){
  const {project,theme}=fixture();edit(theme);
  assert.throws(()=>createScene(project,theme),reason);
 }
});
test('animated tiles cull distant scenery in a validated 256x256 world',()=>{
 const {project,theme}=fixture();
 project.maps.large={name:'Huge',rows:Array(256).fill('.'.repeat(256)),
  exits:{},events:{},encounters:{},visualLayers:[
   {depth:'canopy',cells:{'255,255':'spark','0,0':'spark'}}]};
 const e=createEngine(project),s=e.fresh('Large');
 s.player.map='large';s.player.x=255;s.player.y=255;
 assert.equal(e.validateState(s),true);
 const rendered=createScene(project,theme).compose(e.view(s),{
  width:96,height:96,tick:2});
 assert.equal(rendered.commands.filter(x=>x.layer===2).length,1);
 assert.equal(rendered.commands.find(x=>x.layer===2).source.x,128);
 assert.ok(rendered.commands.length<25);
 assert.deepEqual(e.restore(e.serialize(s)),s);
});
test('animation remains loaded by native Rhino and Android build contracts',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 assert.match(read('tests/framework-rhino.js'),/PASS animated tile frame selection under Rhino/);
 assert.match(read('android/build.sh'),/framework\/\*\.js/);
 assert.match(read('.github/workflows/engine-ci.yml'),/framework\/scene\.js/);
 assert.match(read('enginehost/boot.js'),/animatedTileAudit:animatedTileAudit/);
 assert.match(read('android/test/RouteRunner.java'),/BearframeHost\.animatedTileAudit\(\)/);
 assert.match(read('android/test/RouteRunner.java'),/getInt\("changedPixels"\)<=20/);
});
