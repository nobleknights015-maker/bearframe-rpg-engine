const test=require('node:test'),assert=require('node:assert/strict');
const createEngine=require('../framework/runtime'),createScene=require('../framework/scene'),data=require('../fixtures/engine-project');
const theme={
 tileSize:32,clearColor:'#101018',
 atlases:{terrain:{width:256,height:256},characters:{width:256,height:256}},
 tiles:{floor:{atlas:'terrain',x:0,y:0,w:32,h:32},wall:{atlas:'terrain',x:32,y:0,w:32,h:32}},
 sprites:{
  player:{ticksPerFrame:6,frames:[
   {atlas:'characters',x:0,y:0,w:32,h:48},
   {atlas:'characters',x:32,y:0,w:32,h:48}]},
  scout:{ticksPerFrame:8,frames:[{atlas:'characters',x:0,y:48,w:32,h:32}]}
 }
};
const clone=x=>JSON.parse(JSON.stringify(x));
const setup=()=>({engine:createEngine(data),composer:createScene(data,theme)});
test('rejects unknown atlases, invalid coordinates, dimensions and missing required art',()=>{
  const change=fn=>{const next=clone(theme);fn(next);return next;};
  assert.throws(()=>createScene(data,change(s=>s.tileSize=0)),/tileSize/);
  assert.throws(()=>createScene(data,change(s=>s.tiles.floor.x=255)),/outside atlas/);
  assert.throws(()=>createScene(data,change(s=>s.tiles.floor.w=31)),/tile frames/);
  assert.throws(()=>createScene(data,change(s=>delete s.sprites.player)),/player animation/);
  assert.throws(()=>createScene(data,change(s=>s.sprites.player.ticksPerFrame=0)),/invalid animation/);
  assert.throws(()=>createScene(data,change(s=>s.clearColor='red')),/clearColor/);
});
test('composes predictable pixel-snapped commands without mutating simulation or theme',()=>{
  const {engine,composer}=setup(),s=engine.fresh('Visual');
  const before=engine.serialize(s), art=JSON.stringify(theme);
  const view=engine.view(s),scene=composer.compose(view,{width:96,height:96,tick:0});
  assert.equal(scene.width,96);assert.equal(scene.height,96);
  assert.equal(scene.map,'hub');
  assert.deepEqual(scene.camera,{x:0,y:0});
  assert.equal(scene.commands[0].type,'clear');
  assert.equal(scene.commands.filter(c=>c.type==='sprite'&&c.layer===0).length,9);
  const player=scene.commands.find(c=>c.actor==='player');
  assert.ok(player);
  assert.equal(player.imageId,'characters');
  assert.deepEqual(player.source,{x:0,y:0,w:32,h:48});
  assert.equal(JSON.stringify(theme),art);
  assert.equal(engine.serialize(s),before);
});
test('selects animations using an explicit deterministic tick, not wall clock',()=>{
  const {engine,composer}=setup(),view=engine.view(engine.fresh('Visual'));
  const first=composer.compose(view,{width:96,height:96,tick:0});
  const next=composer.compose(view,{width:96,height:96,tick:6});
  assert.equal(first.commands.find(c=>c.actor==='player').source.x,0);
  assert.equal(next.commands.find(c=>c.actor==='player').source.x,32);
  assert.deepEqual(composer.compose(view,{width:96,height:96,tick:6}),next);
  assert.equal(composer.compose(view,{width:96,height:96,tick:12}).commands.find(c=>c.actor==='player').source.x,0);
});
test('depth-sorts actors and keeps them within the scene contract',()=>{
  const {engine,composer}=setup(),view=engine.view(engine.fresh('Visual'));
  const scene=composer.compose(view,{width:224,height:160,tick:8,actors:[
    {id:'zeta',sprite:'scout',x:4,y:3},
    {id:'alpha',sprite:'scout',x:2,y:1},
    {id:'beta',sprite:'scout',x:3,y:1}
  ]});
  const ids=scene.commands.filter(c=>c.actor).map(c=>c.actor);
  assert.deepEqual(ids,['alpha','beta','player','zeta']); // equal-row actors sorted by stable id
  assert.throws(()=>composer.compose(view,{actors:[{id:'bad',sprite:'scout',x:0,y:0}]}),/Invalid scene actor/);
  assert.throws(()=>composer.compose(view,{actors:[{id:'bad',sprite:'missing',x:2,y:2}]}),/Unknown sprite/);
});
test('cameras clamp within large worlds, center small worlds, and cull distant tiles',()=>{
  const {engine,composer}=setup();
  let view=engine.view(engine.fresh('Visual'));
  const large=composer.compose({...view,x:5,y:3},{width:64,height:64});
  assert.equal(large.camera.x,144);
  assert.equal(large.camera.y,80);
  assert.ok(large.visibleTiles<=9);
  const small=composer.compose(view,{width:480,height:320});
  assert.ok(small.camera.x<0&&small.camera.y<0);
  assert.equal(small.visibleTiles,35);
  assert.throws(()=>composer.compose({...view,rows:['bad']}),/disagree/);
  assert.throws(()=>composer.compose(view,{width:0}),/viewport/);
});
