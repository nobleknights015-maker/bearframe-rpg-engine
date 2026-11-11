const test=require('node:test'),assert=require('node:assert/strict');
const createEngine=require('../framework/runtime');
const createScene=require('../framework/scene');
const createSession=require('../framework/session');
const project=require('../fixtures/engine-project');
const theme={tileSize:32,clearColor:'#101018',
 atlases:{terrain:{width:64,height:32},characters:{width:64,height:48}},
 tiles:{floor:{atlas:'terrain',x:0,y:0,w:32,h:32},
   wall:{atlas:'terrain',x:32,y:0,w:32,h:32}},
 sprites:{player:{ticksPerFrame:1,frames:[{atlas:'characters',x:0,y:0,w:32,h:48}]}}};
function setup(){
 const e=createEngine(project),state=e.fresh('Camera',17);
 return {e,state,scene:createScene(project,theme)};
}
test('camera focuses different tiles without relocating saved player or events',()=>{
 const {e,state,scene}=setup(),before=e.serialize(state);
 const v=e.view(state),opts={width:64,height:64,tick:0};
 const ordinary=scene.compose(v,opts);
 const focused=scene.compose(v,{...opts,cameraTarget:{x:5,y:3}});
 assert.deepEqual(focused.camera,{x:144,y:80});
 assert.notDeepEqual(focused.camera,ordinary.camera);
 assert.equal(focused.map,'hub');
 assert.deepEqual(focused.commands[0],ordinary.commands[0]);
 assert.equal(e.serialize(state),before);
 assert.deepEqual(scene.compose(v,{...opts,cameraTarget:{x:5,y:3}}),focused);
 assert.deepEqual(scene.compose(v,{...opts,cameraTarget:{x:4.5,y:2.5}}).camera,
   {x:128,y:64},'fractional focus must still pixel-snap camera output');
});
test('camera clamps at map corners and centers maps smaller than viewport',()=>{
 const {e,state,scene}=setup(),v=e.view(state);
 assert.deepEqual(scene.compose(v,{width:64,height:64,
   cameraTarget:{x:6,y:4}}).camera,{x:160,y:96});
 const a=scene.compose(v,{width:480,height:320,cameraTarget:{x:5,y:3}});
 const b=scene.compose(v,{width:480,height:320});
 assert.deepEqual(a.camera,b.camera,'small worlds remain centered');
});
test('invalid camera coordinates fail before producing any scene commands',()=>{
 const {e,state,scene}=setup(),v=e.view(state);
 for(const bad of [null,[],{}, {x:0},{x:'1',y:2},
  {x:NaN,y:1},{x:Infinity,y:1},{x:-1,y:1},
  {x:7,y:1},{x:1,y:5}])
  assert.throws(()=>scene.compose(v,{cameraTarget:bad}),/Invalid scene camera target/);
});
test('session camera composition is read-only across saved revisions and restart',()=>{
 const bytes=Object.create(null),storage={
   read:k=>Object.prototype.hasOwnProperty.call(bytes,k)?bytes[k]:null,
   write:(k,v)=>{bytes[k]=v;return true;}};
 const s=createSession(project,storage,theme,{slotPrefix:'bf:camera-readonly'});
 assert.equal(s.start('Camera',42).ok,true);
 const before=s.serialize(),keys=Object.keys(bytes);
 assert.deepEqual(s.compose({width:64,height:64,cameraTarget:{x:5,y:3}}).camera,
   {x:144,y:80});
 assert.equal(s.serialize(),before);
 assert.deepEqual(Object.keys(bytes),keys);
 assert.equal(s.verifySave().ok,true);
 const other=createSession(project,storage,theme,{slotPrefix:'bf:camera-readonly'});
 assert.equal(other.resume().ok,true);
 assert.equal(other.serialize(),before);
});
test('Android emulator must verify camera focus without changing canonical coordinates',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const src=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const java=src('android/test/RouteRunner.java');
 assert.match(java,/cameraTarget:\{x:5,y:3\}/);
 assert.match(java,/getBoolean\("cameraSafe"\)/);
 assert.match(src('.github/workflows/engine-ci.yml'),/stage unified-landscape/);
});
