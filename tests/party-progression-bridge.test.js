const test=require('node:test'),assert=require('node:assert/strict');
const create=require('../framework/runtime'),makeSession=require('../framework/session');
const project=require('../fixtures/party-engine-project');
const v1=require('../fixtures/engine-project');
const clone=x=>JSON.parse(JSON.stringify(x));
const walk=(e,s,dirs)=>dirs.reduce((t,d)=>e.step(t,{type:'move',dir:d}),s);
const round={type:'party-round',orders:[{actor:'pilot',skill:'strike',target:'crawler'}]};
test('world weapon damage applies in v2 party combat from the same saved equipment slot',()=>{
 const e=create(clone(project));
 let s=e.fresh('Weapon test',49);
 s=e.step(s,{type:'move',dir:'right'});
 s=e.step(s,{type:'choose',id:'collect'});
 const geared=e.step(s,{type:'equip',item:'blade'});
 const bare=e.step(geared,{type:'unequip'});
 const armed=walk(e,geared,['right','right']);
 const unarmed=walk(e,bare,['right','right']);
 assert.equal(armed.partyBattle.encounter.party[0].attack,14);
 assert.equal(unarmed.partyBattle.encounter.party[0].attack,10);
 const a=e.step(armed,round),b=e.step(unarmed,round);
 assert.equal(b.partyBattle.encounter.foes[0].hp-a.partyBattle.encounter.foes[0].hp,4);
 assert.ok(e.validateState(a));
 assert.deepEqual(e.restore(e.serialize(a)),a);
});
test('battle HUD and cloned roster reflect live HP/MP rather than saved prebattle values',()=>{
 const e=create(clone(project));
 let s=e.fresh('Pilot name',33);
 assert.equal(e.view(s).partyActors[0].name,'Pilot name');
 assert.equal(e.view(s).partyActors[0].mp,3);
 s=walk(e,s,['down','down','right','right','up','up']);
 const live=e.step(s,{type:'party-round',orders:[{actor:'pilot',skill:'pulse',target:'crawler'}]});
 const view=e.view(live);
 assert.equal(live.player.charge,3);
 assert.equal(view.charge,2);
 assert.equal(view.hp,view.partyActors[0].hp);
 assert.equal(view.charge,view.partyActors[0].mp);
 assert.deepEqual(view.partyActors,view.partyBattle.encounter.party);
 view.partyActors[0].hp=9999;
 view.partyActors[0].skills.length=0;
 assert.deepEqual(e.restore(e.serialize(live)),live);
 const old=create(clone(v1));assert.equal('partyActors' in old.view(old.fresh('Old',33)),false);
});
test('roster view exposes persisted ally resources outside battle and encounter values inside',()=>{
 const e=create(clone(project)),s=e.fresh('Scout leader',61);
 s.allies.push('scout');s.allyStats.scout={hp:19,mp:1};
 assert.equal(e.validateState(s),true);
 assert.equal(e.view(s).partyActors[1].hp,19);
 assert.equal(e.view(s).partyActors[1].mp,1);
 const battle=walk(e,s,['down','down','right','right','up','up']);
 assert.equal(e.view(battle).partyActors[1].hp,19);
});
test('shared journal persists equipped party attacks and live roster through process restart',()=>{
 const disk=Object.create(null),store={
   read:k=>Object.prototype.hasOwnProperty.call(disk,k)?disk[k]:null,
   write:(k,v)=>{disk[k]=v;return true;}
 };
 const opts={slotPrefix:'bf:party-gear-journal:v2'};
 let session=makeSession(clone(project),store,null,opts);
 assert.equal(session.start('Gear test',91).ok,true);
 for(const command of [
 {type:'move',dir:'right'},{type:'choose',id:'collect'},
 {type:'equip',item:'blade'},{type:'move',dir:'right'},
 {type:'move',dir:'right'},round
 ])assert.equal(session.dispatch(command).ok,true);
 const state=session.serialize(),view=session.snapshot().view;
 assert.equal(view.partyActors[0].attack,14);
 assert.equal(view.partyActors[0].hp,view.hp);
 assert.equal(view.partyActors[0].mp,view.charge);
 session=makeSession(clone(project),store,null,opts);
 assert.equal(session.resume().ok,true);
 assert.equal(session.serialize(),state);
 assert.deepEqual(session.snapshot().view.partyActors,view.partyActors);
 assert.equal(session.verifySave().ok,true);
});
test('equipment-adjusted party attack respects actor stat ceiling',()=>{
 const p=clone(project);p.partyCombat.player.attack=9998;p.items.blade.power=999;
 const e=create(p);
 let s=e.fresh('Limit',32);
 s=e.step(s,{type:'move',dir:'right'});
 s=e.step(s,{type:'choose',id:'collect'});
 s=e.step(s,{type:'equip',item:'blade'});
 assert.equal(e.view(s).partyActors[0].attack,9999);
 s=walk(e,s,['right','right']);
 assert.equal(s.partyBattle.encounter.party[0].attack,9999);
 assert.equal(p.partyCombat.player.attack,9998);
});
