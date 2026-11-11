const test=require('node:test'),assert=require('node:assert/strict');
const make=require('../framework/runtime'),session=require('../framework/session');
const journal=require('../framework/save-slots');
const v2=require('../fixtures/party-engine-project'),v1=require('../fixtures/engine-project');
const clone=x=>JSON.parse(JSON.stringify(x));
const project=()=>clone(v2);
function recruited(e){
 let s=e.fresh('Equip tester',44);
 s.allies.push('scout');
 s.allyStats.scout={hp:24,mp:2};
 s.inventory.blade=1;
 assert.equal(e.validateState(s),true);
 return s;
}
const move=(e,s,dirs)=>dirs.reduce((p,dir)=>e.step(p,{type:'move',dir}),s);
test('recruited members equip from shared physical item inventory, no duplicating one weapon',()=>{
 const e=make(project()),s=recruited(e);
 const ally=e.step(s,{type:'equip',actor:'scout',item:'blade'});
 assert.equal(ally.allyStats.scout.weapon,'blade');
 assert.equal(ally.equipment.weapon,null);
 assert.equal(ally.inventory.blade,1);
 assert.equal(e.step(ally,{type:'equip',actor:'pilot',item:'blade'}),ally);
 assert.equal(e.step(ally,{type:'equip',item:'blade'}),ally);
 assert.equal(e.view(ally).partyEquipment.scout,'blade');
 assert.equal(e.view(ally).partyActors[1].attack,10);
 assert.equal(e.view(ally).partyActors[0].attack,10);
 assert.equal(e.view(s).partyEquipment.scout,null);
 assert.equal(s.allyStats.scout.weapon,undefined);
 assert.deepEqual(e.restore(e.serialize(ally)),ally);
});
test('unequip and reassignment transfer the only weapon to the lead without inventory cloning',()=>{
 const e=make(project()),s=recruited(e);
 const scout=e.step(s,{type:'equip',actor:'scout',item:'blade'});
 const released=e.step(scout,{type:'unequip',actor:'scout'});
 assert.equal(released.allyStats.scout.weapon,undefined);
 const lead=e.step(released,{type:'equip',item:'blade'});
 assert.equal(lead.equipment.weapon,'blade');
 assert.equal(lead.inventory.blade,1);
 assert.equal(e.step(lead,{type:'unequip',actor:'missing'}),lead);
 assert.equal(e.step(lead,{type:'equip',actor:'missing',item:'blade'}),lead);
 assert.equal(e.step(lead,{type:'equip',actor:42,item:'blade'}),lead);
 assert.equal(e.step(lead,{type:'unequip',actor:'scout'}),lead);
});
test('two copies may equip two actors; third reservation is invalid and cannot restore',()=>{
 const p=project();p.items.blade.maxStack=2;
 const e=make(p),s=recruited(e);
 s.inventory.blade=2;
 const lead=e.step(s,{type:'equip',item:'blade'});
 const both=e.step(lead,{type:'equip',actor:'scout',item:'blade'});
 assert.equal(both.inventory.blade,2);
 assert.equal(e.view(both).partyEquipment.pilot,'blade');
 assert.equal(e.view(both).partyEquipment.scout,'blade');
 const invalid=clone(both);invalid.inventory.blade=1;
 assert.equal(e.validateState(invalid),false);
 assert.equal(e.restore(JSON.stringify(invalid)),null);
 const battle=move(e,both,['down','down','right','right','up','up']);
 assert.equal(battle.partyBattle.encounter.party[0].attack,14);
 assert.equal(battle.partyBattle.encounter.party[1].attack,10);
});
test('scripted item removal automatically reconciles worn copies and stays transactional',()=>{
 const p=project();p.items.blade.maxStack=2;
 const e=make(p);
 // The mechanic event is repeatable. Its first choice takes one blade.
 p.events.mechanic.choices[0].effects=[
   {type:'take',item:'blade',qty:1}];
 const adjusted=make(p);
 let s=recruited(adjusted);s.inventory.blade=2;
 s=adjusted.step(s,{type:'equip',item:'blade'});
 s=adjusted.step(s,{type:'equip',actor:'scout',item:'blade'});
 s=adjusted.step(s,{type:'move',dir:'down'});
 s=adjusted.step(s,{type:'move',dir:'right'});
 assert.equal(s.prompt.event,'mechanic');
 const after=adjusted.step(s,{type:'choose',id:'trade'});
 assert.equal(after.inventory.blade,1);
 assert.equal(after.equipment.weapon,'blade','lead keeps first copy');
 assert.equal(after.allyStats.scout.weapon,undefined,'ally must release removed copy');
 assert.equal(adjusted.validateState(after),true);
 const old=e.fresh('Original',11);
 assert.equal(e.validateState(old),true);
});
test('v1 weapon commands, snapshots and saves stay byte-compatible',()=>{
 const e=make(clone(v1));let s=e.fresh('Old',21);
 s.inventory.blade=1;
 const old=e.step(s,{type:'equip',item:'blade'});
 assert.equal(old.equipment.weapon,'blade');
 assert.equal('partyEquipment' in e.view(old),false);
 assert.equal(e.step(old,{type:'unequip'}).equipment.weapon,null);
});
test('equipment state and battle bonuses survive persistent journal restart and failed writes',()=>{
 const p=project(),e=make(p),s=recruited(e),disk=Object.create(null);let fail=false;
 const storage={read:k=>Object.prototype.hasOwnProperty.call(disk,k)?disk[k]:null,
 write:(k,v)=>{if(fail)return false;disk[k]=v;return true;}};
 const prefix='bf:party-ally-gear:v2:durable',j=journal(e,storage,prefix);
 assert.equal(j.save(s).ok,true);
 let host=session(p,storage,null,{slotPrefix:prefix});
 assert.equal(host.resume().ok,true);
 fail=true;
 assert.equal(host.dispatch({type:'equip',actor:'scout',item:'blade'}).reason,'write-failed');
 assert.equal(host.snapshot().view.partyEquipment.scout,null);
 fail=false;
 assert.equal(host.dispatch({type:'equip',actor:'scout',item:'blade'}).ok,true);
 const stored=host.serialize();
 host=session(p,storage,null,{slotPrefix:prefix});
 assert.equal(host.resume().ok,true);
 assert.equal(host.serialize(),stored);
 assert.equal(host.snapshot().view.partyEquipment.scout,'blade');
 assert.equal(host.snapshot().view.partyActors[1].attack,10);
 assert.equal(host.verifySave().ok,true);
});
test('inventory GUI routes actor-specific equip and unequip commands through canonical session',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const ui=fs.readFileSync(path.join(__dirname,'../enginehost/runtime-panels.js'),'utf8');
 assert.match(ui,/v\.partyActors\.forEach/);
 assert.match(ui,/v\.partyEquipment/);
 assert.match(ui,/actor:actor\.id/);
 assert.match(ui,/allocated>=v\.inventory\[id\]/);
 assert.match(ui,/outcome=dispatch\(command\)/);
});
