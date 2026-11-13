'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const engine=require('../framework/runtime');
const makeScene=require('../framework/scene');
const fixture=require('../fixtures/engine-project');
const clone=x=>JSON.parse(JSON.stringify(x));
const tile=(x,y=0,h=32)=>({atlas:'terrain',x,y,w:32,h});
function setup(){
 const project=clone(fixture);
 const row='.'.repeat(256),cells=(kind,y)=>{
   const out={};for(let x=0;x<256;x++)out[x+','+y]=kind;return out;
 };
 project.maps.expansive={
   name:'Large scenery stress map',rows:Array(256).fill(row),
   events:{},encounters:{},
   exits:{
     '128,100':{map:'hub',x:1,y:1},
     '127,100':{map:'hub',x:2,y:1}
   },
   visualLayers:[
     {depth:'ground',cells:cells('grass',100)},
     {depth:'ground',cells:cells('grate',100)},
     {depth:'canopy',cells:cells('roof',100)}
   ]
 };
 const theme={
   tileSize:32,clearColor:'#101018',
   atlases:{terrain:{width:192,height:64},characters:{width:64,height:48}},
   tiles:{
     floor:tile(0),wall:tile(32),
     grass:tile(64),grate:tile(96),roof:tile(128)
   },
   portals:{expansive:{atlas:'terrain',x:0,y:0,w:32,h:64}},
   sprites:{player:{ticksPerFrame:3,
     frames:[{atlas:'characters',x:0,y:0,w:32,h:48}]}}
 };
 const runtime=engine(project),state=runtime.fresh('Render-only',37);
 state.player.map='expansive';state.player.x=127;state.player.y=100;
 assert.ok(runtime.validateState(state));
 return {project,theme,runtime,state,view:runtime.view(state)};
}
test('dense 256x256 layered scenery culls distant columns and keeps authored overlap order',()=>{
 const h=setup(),c=makeScene(h.project,h.theme);
 const before=h.runtime.serialize(h.state);
 const frame=c.compose(h.view,{width:192,height:96,tick:4});
 const under=frame.commands.filter(x=>x.layer===0.5);
 const canopy=frame.commands.filter(x=>x.layer===2);
 const floor=frame.commands.filter(x=>x.layer===0);
 assert.equal(frame.visibleTiles,21);
 assert.equal(floor.length,21);
 assert.equal(under.length,14);
 assert.equal(canopy.length,7);
 for(let x=124;x<=130;x++){
   assert.deepEqual(under.filter(v=>v.world.x===x).map(v=>v.source.x),
     [64,96], 'layer x sorting must retain original authored overlay order');
 }
 assert.deepEqual(canopy.map(v=>v.world.x),[124,125,126,127,128,129,130]);
 const portals=frame.commands.filter(v=>v.exit);
 assert.equal(portals.length,2);
 assert.deepEqual(portals.map(p=>p.exit.map),['hub','hub']);
 assert.ok(frame.commands.indexOf(portals[0])<frame.commands.findIndex(v=>v.actor==='player'));
 assert.deepEqual(c.compose(h.view,{width:192,height:96,tick:4}),frame);
 assert.equal(h.runtime.serialize(h.state),before,'scene compositing cannot mutate the save');
});
test('large scenery camera near x=0 and x=255 never leaks far-away layered commands',()=>{
 const h=setup(),scene=makeScene(h.project,h.theme);
 for(const x of [0,255]){
   const view={...h.view,x,y:100,freePosition:undefined};
   const frame=scene.compose(view,{width:96,height:96,tick:0});
   const candidates=frame.commands.filter(c=>c.layer===0.5||c.layer===2);
   assert.ok(candidates.length<=18,'at most six columns across three layers');
   assert.ok(candidates.every(c=>x===0?c.world.x<4:c.world.x>251));
 }
});
test('composer snapshots full authored layers and entrances despite external mutations',()=>{
 const h=setup(),scene=makeScene(h.project,h.theme);
 const expected=scene.compose(h.view,{width:192,height:96,tick:0});
 h.project.maps.expansive.visualLayers[0].cells['127,100']='roof';
 h.project.maps.expansive.exits['127,100']={map:'hub',x:0,y:0};
 h.theme.tiles.grass.x=0;
 assert.deepEqual(scene.compose(h.view,{width:192,height:96,tick:0}),expected);
});
test('large-map scenery uses sorted indexed row seek and preindexed exit keys',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const src=fs.readFileSync(path.join(__dirname,'../framework/scene.js'),'utf8');
 assert.match(src,/exitKeys\[mapId\]=Object\.keys\(project\.maps\[mapId\]\.exits\)\.sort\(\)/);
 assert.match(src,/while\(low<high\)/);
 assert.match(src,/if\(entries\[mid\]\.x<minX\)low=mid\+1/);
 assert.match(src,/for\(var i=low;i<entries\.length&&entries\[i\]\.x<maxX;i\+\+\)/);
 assert.doesNotMatch(src,/Object\.keys\(map\.exits\)\.sort\(\)\.forEach/);
});
