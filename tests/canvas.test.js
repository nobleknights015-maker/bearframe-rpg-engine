const test=require('node:test'),assert=require('node:assert/strict');
const create=require('../framework/runtime'),sceneKit=require('../framework/scene'),draw=require('../framework/canvas');
const world=require('../fixtures/engine-project');
const theme={
  tileSize:32,clearColor:'#101018',
  atlases:{terrain:{width:256,height:256},characters:{width:256,height:256}},
  tiles:{floor:{atlas:'terrain',x:0,y:0,w:32,h:32},wall:{atlas:'terrain',x:32,y:0,w:32,h:32}},
  sprites:{player:{ticksPerFrame:5,frames:[{atlas:'characters',x:0,y:0,w:32,h:48}]}}
};
const make=()=>{
 const engine=create(world);
 const composer=sceneKit(world,theme);
 return composer.compose(engine.view(engine.fresh('Canvas')),{width:96,height:96});
};
const mock=()=>{
 const log=[],ctx={imageSmoothingEnabled:true};
 for(const name of ['save','restore','beginPath','rect','clip','fillRect','drawImage'])
   ctx[name]=(...args)=>log.push({name,args});
 return {canvas:{getContext:()=>ctx},ctx,log};
};
const images=()=>({
 terrain:{complete:true,naturalWidth:256,naturalHeight:256},
 characters:{complete:true,naturalWidth:256,naturalHeight:256}
});
test('presents deterministic source/destination sprite rectangles and disables smoothing',()=>{
 const f=make(),m=mock();
 const result=draw(m.canvas,f,images());
 assert.equal(result.commandCount,f.commands.length);
 assert.equal(result.spritesDrawn,f.commands.filter(x=>x.type==='sprite').length);
 assert.equal(m.ctx.imageSmoothingEnabled,false);
 assert.equal(m.log[0].name,'save');
 assert.equal(m.log.at(-1).name,'restore');
 assert.equal(m.log.filter(x=>x.name==='drawImage').length,result.spritesDrawn);
 assert.equal(m.log.filter(x=>x.name==='clip').length,1);
});
test('preflights every image before drawing a partial frame',()=>{
 const f=make(),m=mock(),img=images();
 delete img.characters;
 assert.throws(()=>draw(m.canvas,f,img),/Missing image atlas characters/);
 assert.equal(m.log.length,0);
 const m2=mock(),notReady=images();
 notReady.terrain.complete=false;
 assert.throws(()=>draw(m2.canvas,f,notReady),/not ready/);
 assert.equal(m2.log.length,0);
 const m3=mock(),short=images();
 short.terrain.naturalWidth=16;
 assert.throws(()=>draw(m3.canvas,f,short),/rectangle invalid/);
 assert.equal(m3.log.length,0);
});
test('rejects unknown draw commands, malformed frames and contexts',()=>{
 const f=make(),m=mock(),img=images();
 assert.throws(()=>draw(null,f,img),/Canvas/);
 assert.throws(()=>draw(m.canvas,{...f,commands:[{type:'arbitrary'}]},img),/Unknown draw command/);
 assert.throws(()=>draw(m.canvas,{...f,commands:[{type:'clear',color:'blue'}]},img),/clear color/);
 assert.throws(()=>draw(m.canvas,{...f,width:0},img),/Invalid scene/);
 assert.throws(()=>draw(m.canvas,{...f,commands:[{type:'sprite',imageId:'terrain',
   source:{x:0,y:0,w:-1,h:32},dest:{x:0,y:0,w:32,h:32}}]},img),/rectangle invalid/);
});
