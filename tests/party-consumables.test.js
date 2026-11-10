const test=require('node:test'),assert=require('node:assert/strict');
const make=require('../framework/runtime'),makeSession=require('../framework/session');
const makeSlots=require('../framework/save-slots');
const fixture=require('../fixtures/party-engine-project');
const old=require('../fixtures/engine-project');
const clone=x=>JSON.parse(JSON.stringify(x));
const create=()=>make(clone(fixture));
function withAlly(e){
 let s=e.fresh('Healer',11);
 s.allies.push('scout');s.allyStats.scout={hp:13,mp:1};
 s.inventory.patch=2;
 assert.equal(e.validateState(s),true);
 return s;
}
test('v2 world consumables heal recruited ally by ID and consume one item atomically',()=>{
 const e=create(),s=withAlly(e),before=e.serialize(s);
 const healed=e.step(s,{type:'use',item:'patch',target:'scout'});
 assert.equal(healed.allyStats.scout.hp,24);
 assert.equal(healed.allyStats.scout.mp,1);
 assert.equal(healed.inventory.patch,1);
 assert.equal(healed.player.hp,s.player.hp);
 assert.equal(healed.sequence,s.sequence+1);
 assert.equal(e.serialize(s),before,'original state mutated');
 assert.deepEqual(e.restore(e.serialize(healed)),healed);
 assert.equal(e.view(healed).partyActors[1].hp,24);
});
test('target validation rejects unknown, unjoined or full-health actors without using an item',()=>{
 const e=create(),s=withAlly(e);
 for(const target of ['missing','Crawler',null,42,{},'scout_wrong'])
  assert.equal(e.step(s,{type:'use',item:'patch',target}),s);
 const healed=e.step(s,{type:'use',item:'patch',target:'scout'});
 assert.equal(e.step(healed,{type:'use',item:'patch',target:'scout'}),healed);
 const absent=e.fresh('No ally',19);absent.inventory.patch=1;
 assert.equal(e.step(absent,{type:'use',item:'patch',target:'scout'}),absent);
 assert.deepEqual(s.inventory,{patch:2});
});
test('v2 default target remains the lead; v1 unaffected',()=>{
 const e=create(),s=withAlly(e);
 s.player.hp=17;
 const lead=e.step(s,{type:'use',item:'patch'});
 assert.equal(lead.player.hp,29);
 assert.equal(lead.allyStats.scout.hp,13);
 assert.equal(lead.inventory.patch,1);
 const named=e.step(s,{type:'use',item:'patch',target:'pilot'});
 assert.deepEqual(named,lead);
 const oldEngine=make(clone(old)),v1=oldEngine.fresh('Classic',24);
 v1.inventory.patch=1;v1.player.hp=18;
 const recovered=oldEngine.step(v1,{type:'use',item:'patch'});
 assert.equal(recovered.player.hp,30);
 assert.equal(recovered.inventory.patch,undefined);
});
test('party healing saved in same journal; restart and failed-write never lose items',()=>{
 const e=create(),state=withAlly(e),disk=Object.create(null);let fail=false;
 const storage={read:key=>Object.prototype.hasOwnProperty.call(disk,key)?disk[key]:null,
 write:(key,val)=>{if(fail)return false;disk[key]=val;return true;}};
 const prefix='bf:party-heal:v2:checkpoint',slots=makeSlots(e,storage,prefix);
 assert.equal(slots.save(state).ok,true);
 let session=makeSession(clone(fixture),storage,null,{slotPrefix:prefix});
 assert.equal(session.resume().ok,true);
 fail=true;
 assert.equal(session.dispatch({type:'use',item:'patch',target:'scout'}).reason,'write-failed');
 assert.equal(session.snapshot().view.partyActors[1].hp,13);
 assert.equal(session.snapshot().view.inventory.patch,2);
 fail=false;
 assert.equal(session.dispatch({type:'use',item:'patch',target:'scout'}).ok,true);
 const value=session.serialize();
 session=makeSession(clone(fixture),storage,null,{slotPrefix:prefix});
 assert.equal(session.resume().ok,true);
 assert.equal(session.serialize(),value);
 assert.equal(session.snapshot().view.partyActors[1].hp,24);
 assert.equal(session.snapshot().view.inventory.patch,1);
 assert.equal(session.verifySave().ok,true);
});
test('party inventory UI exposes actor-targeted commands without a second journal',()=>{
 const fs=require('node:fs');
 const ui=fs.readFileSync(require('node:path').join(__dirname,'../enginehost/runtime-panels.js'),'utf8');
 assert.match(ui,/v\.partyActors\.forEach/);
 assert.match(ui,/target:actor\.id/);
 assert.match(ui,/actor\.hp>=actor\.maxHp/);
 assert.match(ui,/outcome=dispatch\(command\)/);
});
