const test=require('node:test'),assert=require('node:assert/strict');
const validate=require('../framework/schema'),create=require('../framework/runtime');
const makeSession=require('../framework/session');
const base=require('../fixtures/party-engine-project'),v1=require('../fixtures/engine-project');
const clone=x=>JSON.parse(JSON.stringify(x));
function definition(){
 const p=clone(base);
 p.items.vest={kind:'armor',name:'Padded vest',maxStack:2,defense:8};
 p.items.charm={kind:'accessory',name:'Swift charm',maxStack:2,attack:2,defense:1,speed:3};
 p.events.supply.choices[0].effects.push({type:'give',item:'vest',qty:2});
 p.events.supply.choices[0].effects.push({type:'give',item:'charm',qty:2});
 return p;
}
function allyState(e){
 let s=e.fresh('Geared',31);
 s.allies.push('scout');s.allyStats.scout={hp:24,mp:2};
 s.inventory.vest=2;s.inventory.charm=2;
 return s;
}
const walk=(e,s,dirs)=>dirs.reduce((p,dir)=>e.step(p,{type:'move',dir}),s);
test('schema accepts armor and accessory modifiers but rejects invalid kinds and stats',()=>{
 const p=definition();assert.equal(validate(p),p);
 for(const mutate of [
  p=>p.items.vest.defense=1000,
  p=>p.items.vest.defense=-1,
  p=>p.items.charm.attack=1.5,
  p=>p.items.charm.speed=-10,
  p=>{delete p.items.charm.attack;delete p.items.charm.defense;delete p.items.charm.speed;},
  p=>p.items.charm.kind='artifact'
 ]){const invalid=definition();mutate(invalid);assert.throws(()=>validate(invalid),/item charm|item vest/);}
});
test('each actor can equip armor/accessory; combat applies bounded additive stats',()=>{
 const e=create(definition());let s=allyState(e);
 s=e.step(s,{type:'equip',actor:'scout',item:'vest'});
 s=e.step(s,{type:'equip',actor:'scout',item:'charm'});
 s=e.step(s,{type:'equip',item:'vest'});
 s=e.step(s,{type:'equip',item:'charm'});
 assert.equal(s.inventory.vest,2);
 assert.equal(s.inventory.charm,2);
 assert.equal(e.view(s).partyGear.scout.armor,'vest');
 assert.equal(e.view(s).partyGear.pilot.accessory,'charm');
 assert.equal(e.view(s).partyEquipment.scout,null,'old weapon view remains compatible');
 const roster=e.view(s).partyActors;
 assert.equal(roster[0].attack,12);
 assert.equal(roster[0].defense,13);
 assert.equal(roster[0].speed,12);
 assert.equal(roster[1].attack,8);
 assert.equal(roster[1].defense,11);
 assert.equal(roster[1].speed,8);
 const inBattle=walk(e,s,['down','down','right','right','up','up']);
 assert.deepEqual(inBattle.partyBattle.encounter.party.map(a=>[a.attack,a.defense,a.speed]),
   [[12,13,12],[8,11,8]]);
 assert.ok(e.restore(e.serialize(inBattle)));
});
test('an armor or charm may not be duplicated beyond inventory quantity',()=>{
 const p=definition();p.items.vest.maxStack=1;
 const e=create(p);let s=allyState(e);s.inventory.vest=1;
 const on=e.step(s,{type:'equip',actor:'scout',item:'vest'});
 assert.equal(e.step(on,{type:'equip',item:'vest'}),on);
 assert.equal(on.inventory.vest,1);
 const invalid=clone(on);invalid.equipment.armor='vest';
 assert.equal(e.restore(JSON.stringify(invalid)),null);
 assert.equal(e.validateState(invalid),false);
});
test('per-slot unequip does not accidentally remove other gear, v1 saves stay unchanged',()=>{
 const e=create(definition());let s=allyState(e);
 s=e.step(s,{type:'equip',actor:'scout',item:'vest'});
 s=e.step(s,{type:'equip',actor:'scout',item:'charm'});
 const onlyCharm=e.step(s,{type:'unequip',actor:'scout',slot:'armor'});
 assert.equal(onlyCharm.allyStats.scout.armor,undefined);
 assert.equal(onlyCharm.allyStats.scout.accessory,'charm');
 assert.equal(e.step(onlyCharm,{type:'unequip',actor:'scout',slot:'armor'}),onlyCharm);
 assert.equal(e.step(onlyCharm,{type:'unequip',actor:'scout',slot:'invalid'}),onlyCharm);
 const classic=create(clone(v1)),fresh=classic.fresh('Old',18);
 assert.deepEqual(fresh.equipment,{weapon:null});
 assert.equal(classic.restore(classic.serialize(fresh)).version,1);
});
test('item removal during events releases only excessive armor reservations',()=>{
 const p=definition();
 p.events.mechanic.choices[0].effects=[{type:'take',item:'vest',qty:1}];
 const e=create(p);let s=allyState(e);
 s=e.step(s,{type:'equip',item:'vest'});
 s=e.step(s,{type:'equip',actor:'scout',item:'vest'});
 s=walk(e,s,['down','right']);
 const done=e.step(s,{type:'choose',id:'trade'});
 assert.equal(done.inventory.vest,1);
 assert.equal(done.equipment.armor,'vest');
 assert.equal(done.allyStats.scout.armor,undefined);
 assert.equal(done.allyStats.scout.charm,undefined);
 assert.equal(e.validateState(done),true);
});
test('world armor/accessory remains durable through session restart',()=>{
 const p=definition(),e=create(p);
 const storeData=Object.create(null),store={read:k=>storeData[k]||null,
  write:(k,v)=>{storeData[k]=v;return true;}};
 const opts={slotPrefix:'bf:gear-slots:v2:test'};
 let s=makeSession(p,store,null,opts);
 assert.equal(s.start('Gear',11).ok,true);
 assert.equal(s.dispatch({type:'move',dir:'right'}).ok,true);
 assert.equal(s.dispatch({type:'choose',id:'collect'}).ok,true);
 assert.equal(s.dispatch({type:'equip',item:'vest'}).ok,true);
 assert.equal(s.dispatch({type:'equip',item:'charm'}).ok,true);
 const before=s.serialize();
 s=makeSession(p,store,null,opts);
 assert.equal(s.resume().ok,true);
 assert.equal(s.serialize(),before);
 assert.equal(s.snapshot().view.equipment.armor,'vest');
 assert.equal(s.snapshot().view.equipment.accessory,'charm');
 assert.equal(s.verifySave().ok,true);
});
test('equipment UI routes armor and accessory through canonical dispatch',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const ui=fs.readFileSync(path.join(__dirname,'../enginehost/runtime-panels.js'),'utf8');
 assert.match(ui,/\['weapon','armor','accessory'\]/);
 assert.match(ui,/v\.partyGear\[actor\.id\]\[item\.kind\]/);
 assert.match(ui,/slot:slot/);
 assert.match(ui,/outcome=dispatch\(command\)/);
});
