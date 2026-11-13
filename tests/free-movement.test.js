'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const makeEngine=require('../framework/runtime');
const makeMovement=require('../framework/free-movement');
const makeScene=require('../framework/scene');
const makeHost=require('../enginehost/party-world-host');
const makeSession=require('../framework/session');
const validate=require('../framework/schema');
const fixture=require('../fixtures/party-world-project');
const base=require('../fixtures/engine-project');
const clone=x=>JSON.parse(JSON.stringify(x));
function freeProject(){
  const p=clone(fixture);
  p.id='free-movement-test';p.contentRevision='free_position_1';
  p.movement={mode:'free',speed:32,radius:48};
  return p;
}
function standalone(map){
  const p=clone(base);
  p.id='free-standalone';p.maps={
    hub:{name:'Free hub',rows:map||['#####','#...#','#...#','#####'],
      exits:{'2,1':{map:'field',x:1,y:1}},events:{},encounters:{}},
    field:{name:'Field',rows:['#####','#...#','#...#','#####'],
      exits:{},events:{},encounters:{}}
  };
  p.start={map:'hub',x:1,y:1};
  p.movement={mode:'free',speed:32,radius:48};
  return p;
}
function storage(){
  const data=Object.create(null);let fail=false;
  return {read:key=>data[key]||null,
    write:(key,val)=>{if(fail)return false;data[key]=val;return true;},
    fail:v=>{fail=v;}};
}
const theme={tileSize:32,clearColor:'#101018',
  atlases:{terrain:{width:64,height:32},players:{width:32,height:32}},
  tiles:{floor:{atlas:'terrain',x:0,y:0,w:32,h:32},
    wall:{atlas:'terrain',x:32,y:0,w:32,h:32}},
  sprites:{player:{frames:[{atlas:'players',x:0,y:0,w:32,h:32}],ticksPerFrame:4}}
};
test('free movement is explicit; old grid projects retain exact step, state and cardinal commands',()=>{
  const p=clone(base),e=makeEngine(p),first=e.fresh('Grid',1);
  assert.equal(e.step(first,{type:'move',dir:'up-right'}),first);
  const moved=e.step(first,{type:'move',dir:'down'});
  assert.equal(moved.player.y,2);
  assert.equal(Object.hasOwn(moved.player,'px'),false);
  assert.equal(Object.hasOwn(e.view(moved),'freePosition'),false);
  assert.equal(e.serialize(e.restore(e.serialize(moved))),e.serialize(moved));
});
test('free locomotion moves within a tile on first input, preserving integer map events',()=>{
  const e=makeEngine(freeProject()),first=e.fresh('Free',13);
  assert.deepEqual({x:first.player.x,y:first.player.y,px:first.player.px,py:first.player.py},
    {x:1,y:1,px:384,py:384});
  const next=e.step(first,{type:'move',dir:'right'});
  assert.equal(next.sequence,1);assert.equal(next.player.x,1);
  assert.equal(next.player.px,416);
  assert.equal(e.view(next).freePosition.x,1.125);
  assert.equal(e.view(next).movementMode,'free');
  assert.notEqual(e.serialize(next),e.serialize(first));
  assert.equal(e.validateState(next),true);
});
test('eight-way diagonal normalization, equal/opposite moves and four-direction animation facing',()=>{
  const p=freeProject(),m=makeMovement(p),start=m.point(1,1);
  const east=m.walk('hub',start,'right');
  const ne=m.walk('hub',start,'up-right');
  assert.equal(east.steps[east.steps.length-1].px-start.px,32);
  assert.equal(ne.steps[ne.steps.length-1].px-start.px,23);
  assert.equal(ne.steps[ne.steps.length-1].py-start.py,-23);
  assert.ok(Math.abs(Math.hypot(23,23)-32)<1);
  assert.equal(m.facing('up-right','right'),'right');
  assert.equal(m.facing('up-right','down'),'up');
  assert.equal(m.facing('down-left','left'),'left');
  for(const dir of ['up','down','left','right','up-left','up-right','down-left','down-right'])
    assert.ok(m.walk('hub',start,dir).ok,dir);
});
test('wall collisions block out-of-bounds and diagonal corner cutting',()=>{
  const p=standalone(['#####','#.#.#','##..#','#...#','#####']);
  p.maps.hub.exits={};const m=makeMovement(p);
  let position=m.point(1,1);
  for(let i=0;i<30;i++){
    const trial=m.walk('hub',position,'down-right');
    if(trial.ok)position=trial.steps[trial.steps.length-1];
  }
  assert.equal(Math.floor(position.px/256),1);
  assert.equal(Math.floor(position.py/256),1);
  assert.ok(m.inside('hub',position.px,position.py));
  assert.equal(m.walk('hub',position,'warp').ok,false);
});
test('axis separation slides along walls while preserving valid player geometry',()=>{
  const p=standalone(['#####','#.#.#','#...#','#...#','#####']);
  p.maps.hub.exits={};const e=makeEngine(p);
  let s=e.fresh('Wall',1);
  for(let i=0;i<8;i++)s=e.step(s,{type:'move',dir:'down-right'});
  assert.ok(s.player.py>384);
  assert.ok(s.player.px>384);
  assert.equal(s.player.x,1);
  assert.equal(e.validateState(s),true);
});
test('crossing event cells uses one-time choices and does not walk through unresolved prompts',()=>{
  const e=makeEngine(freeProject());
  let s=e.fresh('Story',1);
  for(let i=0;i<4;i++)s=e.step(s,{type:'move',dir:'right'});
  assert.ok(s.prompt);assert.equal(s.prompt.event,'supply');
  assert.equal(s.player.x,1);assert.equal(s.player.px,480);
  const blocked=e.step(s,{type:'move',dir:'right'});
  assert.equal(blocked,s,'movement blocked during pending dialogue');
  s=e.step(s,{type:'choose',id:'collect'});
  assert.equal(s.prompt,null);assert.equal(s.inventory.blade,1);
  s=e.step(s,{type:'move',dir:'right'});
  assert.equal(s.player.x,2);
  assert.equal(s.player.px,512);
  assert.equal(e.validateState(s),true);
});
test('exit target centers are exact and stay inside valid map cells',()=>{
  const e=makeEngine(standalone());
  let s=e.fresh('Door',1);
  for(let i=0;i<4;i++)s=e.step(s,{type:'move',dir:'right'});
  assert.equal(s.player.map,'field');
  assert.deepEqual({x:s.player.x,y:s.player.y,px:s.player.px,py:s.player.py},
    {x:1,y:1,px:384,py:384});
  assert.equal(s.message,'Field');
  assert.equal(e.validateState(s),true);
});
test('free positions survive journal restart byte-for-byte and roll back on failed write',()=>{
  const p=freeProject(),disk=storage();
  const first=makeHost(disk,p,theme,{slotPrefix:'bf:free-movement-test:v2:runtime'});
  assert.equal(first.navigate('down-right').ok,true);
  assert.equal(first.view().freePosition.x,1+23/256);
  const saved=first.view().sequence,position=clone(first.view().freePosition);
  disk.fail(true);
  assert.equal(first.navigate('down-right').reason,'write-failed');
  assert.deepEqual(first.view().freePosition,position);
  disk.fail(false);
  const restored=makeHost(disk,p,theme,{slotPrefix:'bf:free-movement-test:v2:runtime'});
  assert.equal(restored.view().sequence,saved);
  assert.deepEqual(restored.view().freePosition,position);
  assert.equal(restored.verifySave().ok,true);
  assert.equal(restored.facing(),'down');
});
test('scene camera and player sample canonical fractional location, without save writes',()=>{
  const p=freeProject(),e=makeEngine(p),a=e.fresh('Scene',1);
  const b=e.step(a,{type:'move',dir:'right'});
  const renderer=makeScene(p,theme);
  const options={width:96,height:96,tick:0};
  const before=renderer.compose(e.view(a),options);
  const after=renderer.compose(e.view(b),options);
  assert.notEqual(after.camera.x,before.camera.x);
  assert.equal(after.commands.find(c=>c.actor==='player').world.x,1.125);
  assert.equal(e.serialize(b),e.serialize(e.restore(e.serialize(b))));
  assert.throws(()=>renderer.compose({...e.view(b),freePosition:{x:4.9,y:1}},options),
    /Invalid precise player position/);
});
test('project movement schema rejects malformed or unsupported movement options',()=>{
  for(const mode of ['teleport','eight-way',null]){
    const p=freeProject();p.movement.mode=mode;
    assert.throws(()=>validate(p),/movement.mode/);
  }
  for(const [key,value] of [['speed',0],['speed',70],['radius',0],
      ['radius',128],['unknown',99]]){
    const p=freeProject();p.movement[key]=value;
    assert.throws(()=>validate(p));
  }
  const p=freeProject();p.movement={mode:'tile',speed:30};
  assert.throws(()=>validate(p));
});
test('WebView and Android input code include eight-way movement without requesting new art',()=>{
 const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
 const html=read('enginehost/index.html'),host=read('enginehost/party-world-host.js');
 const android=read('android/src/dev/bearframe/ridge/ControllerInputRouter.java');
 assert.match(html,/free-movement\.js/);
 for(const dir of ['up-left','up-right','down-left','down-right']){
   assert.ok(html.includes('data-party-world-dir="'+dir+'"'));
   assert.ok(host.includes("'"+dir+"'"));
 }
 assert.match(android,/vertical\+"-"\+horizontal/);
 assert.match(android,/upHeld.*downHeld.*leftHeld.*rightHeld/);
 assert.match(read('enginehost/boot.js'),/partyWorldProject\.movement/);
 assert.match(read('enginehost/touch-pad.js'),/up-left/);
});

test('Android CI installs and executes free locomotion, independent native journal and camera gate',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const java=read('android/test/RouteRunner.java');
 const ci=read('.github/workflows/engine-ci.yml');
 for(const phrase of ['checkUnifiedFreeMovement()',
   'stage.equals("unified-free-movement")',
   "p.movement={mode:'free',speed:32,radius:48}",
   "a.dispatch({type:'move',dir:'up-right'})",
   "a.verifySave().ok", "reboot.resume().ok"])
   assert.ok(java.includes(phrase),'Missing installed free movement probe: '+phrase);
 assert.match(ci,/stage unified-free-movement/);
 assert.match(ci,/route=PASS unified-free-movement/);
});
