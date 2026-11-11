const test=require('node:test'),assert=require('node:assert/strict');
const create=require('../enginehost/party-world-host');
const draw=require('../framework/canvas');
const project=require('../fixtures/party-world-project');
const clone=v=>JSON.parse(JSON.stringify(v));
const theme={tileSize:32,clearColor:'#101018',
 atlases:{terrain:{width:64,height:32},characters:{width:64,height:48}},
 tiles:{floor:{atlas:'terrain',x:0,y:0,w:32,h:32},
        wall:{atlas:'terrain',x:32,y:0,w:32,h:32}},
 sprites:{player:{ticksPerFrame:5,frames:[
   {atlas:'characters',x:0,y:0,w:32,h:48},
   {atlas:'characters',x:32,y:0,w:32,h:48}]}}
};
function disk(){
 const bytes=Object.create(null);let fail=false;
 return {read:k=>Object.prototype.hasOwnProperty.call(bytes,k)?bytes[k]:null,
  write:(k,v)=>{if(fail)return false;bytes[k]=v;return true;},
  fail:v=>{fail=v;}};
}
function mock(){
 const ops=[],ctx={};
 for(const fn of ['save','restore','beginPath','rect','clip','fillRect','drawImage'])
  ctx[fn]=(...args)=>ops.push(fn);
 return {canvas:{getContext:()=>ctx},ops};
}
const atlases={
 terrain:{complete:true,naturalWidth:64,naturalHeight:32},
 characters:{complete:true,naturalWidth:64,naturalHeight:48}
};
test('integrated v2 world scene uses canonical session and same saved map position',()=>{
 const storage=disk(),world=create(storage,clone(project),theme);
 const state=JSON.stringify(world.view()),a=world.compose({width:224,height:160,tick:0});
 assert.equal(a.map,'hub');assert.equal(a.width,224);
 assert.deepEqual(a.commands.find(x=>x.actor==='player').world,{x:1,y:1});
 assert.equal(JSON.stringify(world.view()),state,'rendering mutated state');
 const canvas=mock();
 assert.ok(draw(canvas.canvas,a,atlases).spritesDrawn>1);
 assert.equal(world.verifySave().revision,0);
 assert.equal(world.navigate('down').ok,true);
 const b=world.compose({width:224,height:160,tick:1});
 assert.deepEqual(b.commands.find(x=>x.actor==='player').world,{x:1,y:2});
 assert.notDeepEqual(a.commands.find(x=>x.actor==='player').dest,
                     b.commands.find(x=>x.actor==='player').dest);
 const resumed=create(storage,clone(project),theme);
 assert.deepEqual(resumed.compose({width:224,height:160,tick:1}),b);
 assert.equal(resumed.verifySave().revision,1);
});
test('world rendering refuses missing atlas without a partial frame or save write',()=>{
 const storage=disk(),world=create(storage,clone(project),theme);
 const packet=world.compose({width:224,height:160,tick:3}),surface=mock();
 const before=world.snapshot().journal.latestSequence;
 assert.throws(()=>draw(surface.canvas,packet,{terrain:atlases.terrain}),/Missing image atlas/);
 assert.equal(surface.ops.length,0);
 assert.equal(world.verifySave().revision,before);
 assert.equal(world.view().sequence,0);
});
test('failed world move leaves its old rendered frame intact and restart exact',()=>{
 const store=disk(),world=create(store,clone(project),theme);
 const options={width:224,height:160,tick:0},frame=world.compose(options);
 store.fail(true);
 assert.equal(world.navigate('down').reason,'write-failed');
 assert.deepEqual(world.compose(options),frame);
 store.fail(false);
 assert.deepEqual(create(store,clone(project),theme).compose(options),frame);
});
test('legacy no-theme v2 test host remains supported and composition is opt-in',()=>{
 const storage=disk(),world=create(storage,clone(project));
 assert.equal(world.snapshot().engineVersion,2);
 assert.throws(()=>world.compose({width:224,height:160}),/rendering unavailable/);
});
