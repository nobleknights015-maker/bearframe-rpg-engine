const test=require('node:test'),assert=require('node:assert/strict');
const makeRuntime=require('../framework/runtime');
const makeScene=require('../framework/scene');
const makeSession=require('../framework/session');
const v1=require('../fixtures/engine-project');
const v2=require('../fixtures/party-engine-project');
const clone=x=>JSON.parse(JSON.stringify(x));
const theme=()=>({
 tileSize:32,clearColor:'#101018',
 atlases:{terrain:{width:64,height:64},characters:{width:96,height:96}},
 tiles:{floor:{atlas:'terrain',x:0,y:0,w:32,h:32},
        wall:{atlas:'terrain',x:32,y:0,w:32,h:32}},
 sprites:{player:{ticksPerFrame:5,frames:[
   {atlas:'characters',x:0,y:0,w:32,h:48},
   {atlas:'characters',x:32,y:0,w:32,h:48}]}}
});
const route=(engine,seed)=> {
 let s=engine.fresh('Reference',seed);
 const orders=[{type:'move',dir:'right'},{type:'choose',id:'collect'},
  {type:'move',dir:'right'},{type:'move',dir:'right'}];
 for(const cmd of orders)s=engine.step(s,cmd);
 return s;
};
test('v1 simulation snapshots maps, event choices, item stats, quests and combat parameters',()=>{
 const input=clone(v1),reference=makeRuntime(clone(v1)),subject=makeRuntime(input);
 let before=subject.fresh('Reference',51);
 input.maps.hub.rows[1]='#######';
 input.maps.hub.events['2,1']='mechanic';
 input.events.supply.choices[0].effects[0].item='key';
 input.events.supply.choices[0].effects[0].qty=99;
 input.items.blade.power=800;
 input.items.patch.maxStack=1;
 input.foes.crawler.attack=999;
 input.foes.crawler.hp=999;
 input.quests.survey.stages.splice(0,1);
 input.rules={baseAttack:9999,victoryXp:10000};
 assert.equal(subject.validateState(before),true,'source mutation invalidated prior state');
 const canonical=route(reference,51),tested=route(subject,51);
 assert.deepEqual(tested,canonical,'source mutation changed world script or initial fight');
 assert.equal(tested.inventory.blade,1);
 assert.equal(tested.inventory.patch,2);
 assert.equal(tested.battle.hp,24);
 const order={type:'combat',id:'strike'};
 assert.deepEqual(subject.step(tested,order),reference.step(canonical,order));
 assert.equal(subject.serialize(tested),reference.serialize(canonical));
});
test('scene composer snapshots geometry, atlas metadata and sprite animation',()=>{
 const project=clone(v1),paint=theme(),expectedProject=clone(v1),expectedTheme=clone(paint);
 const ref=makeScene(expectedProject,expectedTheme);
 const renderer=makeScene(project,paint),e=makeRuntime(clone(v1));
 const view=e.view(e.fresh('Reference',21)),opts={width:224,height:160,tick:5};
 const expected=ref.compose(view,opts);
 project.maps.hub.rows[1]='#######';
 paint.clearColor='#ffffff';
 paint.tiles.floor.x=999;
 paint.atlases.terrain.width=1;
 paint.sprites.player.frames[1].x=9999;
 paint.sprites.player.ticksPerFrame=1;
 assert.deepEqual(renderer.compose(view,opts),expected,'external theme changed established render');
 assert.equal(renderer.tileSize,32);
});
test('v2 party skill/actor/encounter template mutations cannot change live or restored rounds',()=>{
 const project=clone(v2),engine=makeRuntime(project),reference=makeRuntime(clone(v2));
 project.partyCombat.player.attack=999;
 project.partyCombat.player.skills=['missing'];
 project.partyCombat.skills.pulse.power=9999;
 project.partyCombat.enemies.crawler.hp=1;
 project.partyCombat.enemies.crawler.attack=999;
 project.partyCombat.allies.scout.attack=999;
 project.foes.crawler.hp=999;
 const a=route(engine,83),b=route(reference,83);
 assert.deepEqual(a,b);
 assert.equal(a.partyBattle.encounter.foes[0].hp,48);
 const order={type:'party-round',orders:[{actor:'pilot',skill:'pulse',target:'crawler'}]};
 const advanced=engine.step(a,order),baseline=reference.step(b,order);
 assert.deepEqual(advanced,baseline);
 assert.deepEqual(engine.restore(engine.serialize(advanced)),baseline);
});
test('original host project/theme changes do not make resumed session render fail',()=>{
 const project=clone(v1),paint=theme(),data=Object.create(null);
 const storage={read:key=>data[key]||null,write:(key,val)=>{data[key]=val;return true;}};
 const session=makeSession(project,storage,paint,{slotPrefix:'bf:project-snapshot:diagnostic'});
 assert.equal(session.start('Reference',31).ok,true);
 assert.equal(session.dispatch({type:'move',dir:'down'}).ok,true);
 const referenceFrame=session.compose({width:224,height:160,tick:7});
 project.maps.hub.rows[1]='#######';
 paint.atlases.characters.height=1;
 paint.tiles.floor.atlas='unknown';
 assert.deepEqual(session.compose({width:224,height:160,tick:7}),referenceFrame);
 assert.equal(session.verifySave().ok,true);
});
test('post-JSON-project validation rejects malicious mutated definition',()=>{
 const input=clone(v1);
 input.toJSON=()=>{const copy=clone(v1);copy.start.x=0;return copy;};
 assert.throws(()=>makeRuntime(input),/destination is blocked/);
 assert.throws(()=>makeScene(input,theme()),/destination is blocked/);
});
