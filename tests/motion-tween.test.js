'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const create=require('../enginehost/motion-tween');
const scene=require('../framework/scene');
const makeEngine=require('../framework/runtime');
const base=require('../fixtures/party-world-project');
const clone=v=>JSON.parse(JSON.stringify(v));
const theme={tileSize:32,clearColor:'#101018',
  atlases:{terrain:{width:64,height:32},actor:{width:32,height:32}},
  tiles:{floor:{atlas:'terrain',x:0,y:0,w:32,h:32},
    wall:{atlas:'terrain',x:32,y:0,w:32,h:32}},
  sprites:{player:{frames:[{atlas:'actor',x:0,y:0,w:32,h:32}],ticksPerFrame:1}}
};
test('subtile tween samples actual accepted movement without modifying its inputs',()=>{
  const t=create(110),a={map:'hub',freePosition:{x:1,y:1}},
    b={map:'hub',freePosition:{x:1.125,y:1}};
  const previous=JSON.stringify(a),next=JSON.stringify(b);
  assert.equal(t.capture(a,b,100),true);
  assert.deepEqual(t.sample(100),{x:1,y:1});
  assert.deepEqual(t.sample(155),{x:1.0625,y:1});
  assert.deepEqual(t.sample(210),{x:1.125,y:1});
  assert.equal(t.active(155),true);
  assert.equal(t.active(211),false);
  assert.equal(JSON.stringify(a),previous);
  assert.equal(JSON.stringify(b),next);
});
test('rapid sequential input starts at visible position and never snaps backwards',()=>{
  const t=create(110),a={map:'hub',freePosition:{x:1,y:1}},
    b={map:'hub',freePosition:{x:1.125,y:1}},
    c={map:'hub',freePosition:{x:1.25,y:1}};
  t.capture(a,b,0);
  assert.equal(t.sample(55).x,1.0625);
  assert.equal(t.capture(b,c,55),true);
  assert.equal(t.sample(55).x,1.0625);
  assert.ok(t.sample(110).x>1.0625);
  assert.equal(t.sample(165).x,1.25);
});
test('map change, missing precise positions and invalid timing cancel tweens',()=>{
  const t=create(110),a={map:'hub',freePosition:{x:1,y:1}},
    b={map:'hub',freePosition:{x:1.125,y:1}};
  t.capture(a,b,0);
  assert.equal(t.capture(b,{map:'field',freePosition:{x:1,y:1}},30),false);
  assert.equal(t.sample(35),null);
  assert.equal(t.capture(a,{map:'hub'},40),false);
  assert.equal(t.capture(a,b,Infinity),false);
  assert.throws(()=>create(0),/duration/);
});
test('renderer follows interpolation-only position and camera without modifying saved state',()=>{
  const p=clone(base);p.id='tween-scene';
  p.movement={mode:'free',speed:32,radius:48};
  const e=makeEngine(p),saved=e.fresh('Test',1);
  const moved=e.step(saved,{type:'move',dir:'right'});
  const composer=scene(p,theme),view=e.view(moved);
  const canonical=composer.compose(view,{width:96,height:96});
  const tweened=composer.compose(view,{width:96,height:96,
    playerDrawPosition:{x:1.0625,y:1},
    cameraTarget:{x:1.0625,y:1}});
  assert.ok(tweened.camera.x<canonical.camera.x);
  assert.equal(tweened.commands.find(c=>c.actor==='player').world.x,1.0625);
  assert.equal(e.serialize(moved),e.serialize(e.restore(e.serialize(moved))));
  assert.throws(()=>composer.compose(view,{playerDrawPosition:{x:Infinity,y:1}}),
    /Invalid player presentation position/);
});
test('WebView presentation interval changes only for free locomotion and all touch routes share one handler',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const boot=read('enginehost/boot.js'),html=read('enginehost/index.html');
 for(const token of [
   'createBearframeMotionTween(110)',
   'intervalMs:freeExploration?16:50',
   'function performPartyMovement(dir)',
   'motionTween.capture(',
   'motionTween.sample(performance.now())',
   'playerDrawPosition=shown',
   'partyWorldTouchPad=createBearframeTouchPad(partyWorldButtons,',
   '      performPartyMovement);',
   'paintPartyWorldFrame(tick,true)'
 ])assert.ok(boot.includes(token),'Missing smooth presentation: '+token);
 assert.match(html,/src="motion-tween\.js"/);
});
