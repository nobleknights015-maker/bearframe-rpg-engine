const test=require('node:test'),assert=require('node:assert/strict');
const make=require('../framework/runtime'),makeSession=require('../framework/session');
const fixture=require('../fixtures/party-engine-project');
const clone=x=>JSON.parse(JSON.stringify(x));
const walk=(e,s,dirs)=>dirs.reduce((p,dir)=>e.step(p,{type:'move',dir}),s);
const orders=[
 {actor:'pilot',skill:'strike',target:'crawler'},
 {actor:'scout',skill:'strike',target:'crawler'}
];
function roster(e){
 let s=e.fresh('Keeper',23);
 s.allies.push('scout');
 s.allyStats.scout={hp:24,mp:2};
 s.inventory.blade=1;
 assert.equal(e.validateState(s),true);
 return e.step(s,{type:'equip',actor:'scout',item:'blade'});
}
test('v2 party victory preserves ally equipped gear and physical inventory reservations',()=>{
 const e=make(clone(fixture));
 let s=roster(e);
 assert.equal(s.allyStats.scout.weapon,'blade');
 const attack=e.view(s).partyActors[1].attack;
 s=walk(e,s,['down','down','right','right','up','up']);
 assert.equal(s.partyBattle.encounter.party[1].attack,attack);
 let rounds=0;
 while(s.partyBattle){
   s=e.step(s,{type:'party-round',orders});
   rounds++;
   assert.ok(rounds<10);
 }
 assert.equal(s.allyStats.scout.weapon,'blade','victory erased equipment');
 assert.equal(s.inventory.blade,1);
 assert.equal(e.view(s).partyGear.scout.weapon,'blade');
 assert.equal(e.view(s).partyActors[1].attack,attack);
 assert.equal(e.validateState(s),true);
 assert.deepEqual(e.restore(e.serialize(s)),s);
});
test('postcombat equipment remains after durable session restart',()=>{
 const e=make(clone(fixture)),state=roster(e),disk=Object.create(null);
 const store={read:k=>Object.prototype.hasOwnProperty.call(disk,k)?disk[k]:null,
   write:(k,v)=>{disk[k]=v;return true;}};
 const opts={slotPrefix:'bf:party-combat-gear:v2:unit'};
 const journal=require('../framework/save-slots')(e,store,opts.slotPrefix);
 assert.equal(journal.save(state).ok,true);
 let s=makeSession(clone(fixture),store,null,opts);
 assert.equal(s.resume().ok,true);
 for(const dir of ['down','down','right','right','up','up'])
   assert.equal(s.dispatch({type:'move',dir}).ok,true);
 for(var i=0;i<10&&s.snapshot().view.partyBattle;i++)
   assert.equal(s.dispatch({type:'party-round',orders}).ok,true);
 assert.equal(s.snapshot().view.partyBattle,null);
 assert.equal(s.snapshot().view.partyGear.scout.weapon,'blade');
 const before=s.serialize();
 s=makeSession(clone(fixture),store,null,opts);
 assert.equal(s.resume().ok,true);
 assert.equal(s.serialize(),before);
 assert.equal(s.snapshot().view.partyGear.scout.weapon,'blade');
 assert.equal(s.verifySave().ok,true);
});
