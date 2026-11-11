const test=require('node:test'),assert=require('node:assert/strict');
const create=require('../framework/pathfinding');
const session=require('../framework/session');
const original=require('../fixtures/engine-project');
const clone=x=>JSON.parse(JSON.stringify(x));
function disk(){
  const bytes=Object.create(null);let writes=0;
  return {read:key=>Object.prototype.hasOwnProperty.call(bytes,key)?bytes[key]:null,
    write:(key,data)=>{bytes[key]=data;writes++;return true;},
    writes:()=>writes};
}
test('world path is deterministic, shortest, and refuses scripted event/encounter tiles',()=>{
  const planner=create(original);
  const view={map:'hub',x:1,y:1};
  const blocked=planner.find(view,{x:2,y:1});
  assert.equal(blocked.ok,false);
  assert.equal(blocked.reason,'trigger');
  assert.deepEqual(blocked.directions,[]);
  const safe=planner.find(view,{x:4,y:3});
  assert.equal(safe.ok,true);
  assert.deepEqual(safe.directions,['down','down','right','right','right']);
  assert.deepEqual(safe.positions.at(-1),{x:4,y:3});
  assert.equal(safe.cost,5);
  assert.deepEqual(planner.find(view,{x:4,y:3}),safe);
  assert.equal(planner.find(view,{x:0,y:0}).reason,'wall');
  assert.equal(planner.find(view,{x:5,y:1}).reason,'trigger');
  assert.equal(planner.find(view,{x:3,y:1}).reason,'trigger');
  assert.deepEqual(planner.find(view,{x:2,y:1},{allowTriggers:true}).directions,
    ['right']);
});
test('completion flags permit resolved one-time events and defeated encounters',()=>{
 const planner=create(original);
 assert.deepEqual(planner.find({map:'hub',x:1,y:1},{x:2,y:1},{
    flags:{'event:hub:2,1':true}}).directions,['right']);
 assert.deepEqual(planner.find({map:'hub',x:2,y:1},{x:3,y:1},{
    flags:{'encounter:hub:3,1':true}}).directions,['right']);
 assert.equal(planner.find({map:'hub',x:1,y:2},{x:2,y:2},{
   flags:{'event:hub:2,2':true}}).reason,'trigger',
   'repeatable NPCs remain interactive');
});
test('planning fails safely on unreachable targets and bounded search',()=>{
 const p=clone(original);
 p.maps.maze={name:'Maze',rows:['#####','#.#.#','#####','#.#.#','#####'],
   exits:{},events:{},encounters:{}};
 const planner=create(p);
 assert.equal(planner.find({map:'maze',x:1,y:1},{x:3,y:1}).reason,'unreachable');
 assert.equal(planner.find({map:'maze',x:1,y:1},{x:1,y:1}).cost,0);
 assert.equal(planner.find({map:'hub',x:1,y:1},{x:4,y:3},{maxNodes:1}).reason,'node-limit');
 assert.throws(()=>planner.find({map:'hub',x:1,y:1},{x:-1,y:1}),/destination/);
 assert.throws(()=>planner.find({map:'missing',x:1,y:1},{x:1,y:2}),/valid map/);
 assert.throws(()=>planner.find({map:'hub',x:0,y:0},{x:1,y:2}),/starting cell/);
 assert.throws(()=>planner.find({map:'hub',x:1,y:1},{x:1,y:2},{maxNodes:0}),/node budget/);
 assert.throws(()=>planner.find({map:'hub',x:1,y:1},{x:1,y:2},{allowTriggers:'yes'}),/allowTriggers/);
});
test('canonical session path plans never dispatch or write and preserve restart compatibility',()=>{
 const store=disk();
 const s=session(original,store,null,{slotPrefix:'bf:planner-test'});
 assert.equal(s.planPath({x:3,y:3}).reason,'not-started');
 assert.equal(s.start('Pilot',15).ok,true);
 const state=s.serialize(),writes=store.writes();
 assert.deepEqual(s.planPath({x:4,y:3}).directions,
  ['down','down','right','right','right']);
 assert.equal(s.serialize(),state);
 assert.equal(store.writes(),writes);
 assert.equal(s.dispatch({type:'move',dir:'right'}).ok,true);
 assert.equal(s.snapshot().view.prompt.event,'supply');
 assert.equal(s.planPath({x:4,y:3}).reason,'busy',
   'dialogue must block suggested movement like the runtime');
 assert.equal(s.dispatch({type:'choose',id:'collect'}).ok,true);
 assert.deepEqual(s.planPath({x:2,y:1}).directions,['right']);
 const still=s.serialize(),before=store.writes();
 const ignored=s.planPath({x:2,y:1},{flags:{'event:hub:2,1':false}});
 assert.equal(ignored.ok,true,'caller must not override saved event flags');
 assert.equal(store.writes(),before);
 assert.equal(s.serialize(),still);
 const reopened=session(original,store,null,{slotPrefix:'bf:planner-test'});
 assert.equal(reopened.resume().ok,true);
 assert.deepEqual(reopened.planPath({x:2,y:1}),s.planPath({x:2,y:1}));
 assert.equal(reopened.verifySave().ok,true);
});
test('planner loads before session in Android WebView and real Rhino check',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const root=path.resolve(__dirname,'..');
 const source=p=>fs.readFileSync(path.join(root,p),'utf8');
 const html=source('enginehost/index.html');
 assert.ok(html.indexOf('pathfinding.js')>0);
 assert.ok(html.indexOf('pathfinding.js')<html.indexOf('session.js'));
 assert.match(source('.github/workflows/engine-ci.yml'),/framework\/pathfinding\.js/);
 assert.match(source('tests/framework-rhino.js'),/unified\.planPath/);
 assert.match(source('android/build.sh'),/framework\/\*\.js/);
});

test('installed world bridge exposes read-only plans from the same journal',()=>{
 const host=require('../enginehost/party-world-host');
 const fixture=require('../fixtures/party-world-project');
 const store=disk(),world=host(store,clone(fixture));
 const before=world.view().sequence,writes=store.writes();
 const route=world.planPath({x:4,y:3});
 assert.equal(route.ok,true);
 assert.equal(route.cost,5);
 assert.deepEqual(route.directions,['down','down','right','right','right']);
 assert.equal(world.view().sequence,before);
 assert.equal(store.writes(),writes);
 assert.equal(world.navigate('right').ok,true);
 assert.equal(world.planPath({x:4,y:3}).reason,'busy');
 assert.equal(world.verifySave().ok,true);
});
