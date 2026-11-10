const test=require('node:test'),assert=require('node:assert/strict');
const runtime=require('../framework/runtime'),makeMapper=require('../framework/legacy-v1-mapper');
const original=require('../game/engine')(require('../game/world'));
const fixture=require('../fixtures/legacy-migration-project');
const importer=require('../framework/save-import'),slots=require('../framework/save-slots');
const e=runtime(fixture.project);
const m=()=>makeMapper({engine:e,mapping:fixture.mapping,legacyRestore:original.restore});
const make=()=>original.fresh('Retro frame','Slate');
test('exact reversible conversion maps every historical field into an approved compatible v1 project',()=>{
 const sources=[];
 sources.push(make());
 const withEquipment=make();withEquipment.flags.bearing=true;withEquipment.hp=35;
 withEquipment.charge=0;withEquipment.weapon='lance';
 withEquipment.flags.E=true;withEquipment.flags.echoAlly=true;
 withEquipment.flags.D=true;withEquipment.flags.gridAlly=true;
 withEquipment.area='ridge';withEquipment.x=3;withEquipment.y=1;
 sources.push(withEquipment);
 const fighting=make();fighting.area='gallery';fighting.x=8;fighting.y=4;
 fighting.battle={key:'H',hp:14,turn:4};fighting.weapon='blade';
 sources.push(fighting);
 const prompted=make();prompted.prompt='M';prompted.area='ridge';
 prompted.x=9;prompted.y=4;sources.push(prompted);
 for(const source of sources){
  assert.ok(original.restore(JSON.stringify(source)));
  const preserved=JSON.stringify(source),mapped=m().map(source);
  assert.equal(mapped.sequence,0);
  assert.deepEqual(m().unmap(mapped),source);
  assert.equal(JSON.stringify(source),preserved);
  assert.ok(e.restore(e.serialize(mapped)));
  assert.equal(mapped.player.map,source.area);
  assert.equal(mapped.player.x,source.x);
  assert.equal(mapped.player.y,source.y);
  assert.equal(mapped.player.hp,source.hp);
  assert.equal(mapped.message,source.message);
  if(source.battle)assert.equal(mapped.battle.turn,source.battle.turn);
  if(source.prompt)assert.equal(mapped.prompt.event,source.prompt);
 }
});
test('consent-based generic importer can write one verified converted state without modifying original',()=>{
 const source=make(),raw=JSON.stringify(source),disk=Object.create(null);
 const storage={read:k=>Object.prototype.hasOwnProperty.call(disk,k)?disk[k]:null,
   write:(k,v)=>{disk[k]=v;return true;}};
 const journal=slots(e,storage,'bf:migration-compat-test:v1');
 const map=m();
 const migration=importer({source:{read:k=>k==='expedition'?raw:null},
   sourceKey:'expedition',destination:journal,engine:e,
   decode:JSON.parse,map:map.map});
 assert.equal(migration.inspect().ok,true);
 assert.equal(journal.health().occupiedSlots,0);
 assert.equal(migration.commit().ok,true);
 assert.equal(JSON.stringify(map.unmap(journal.load())),raw);
 assert.equal(migration.inspect().reason,'destination-occupied');
});
test('unmapped or incompatible project geometry and truncated history fail closed',()=>{
 const source=make();
 assert.throws(()=>makeMapper({engine:e,mapping:{...fixture.mapping,maps:{}},
   legacyRestore:original.restore}),/Incomplete/);
 const m1=m();
 assert.throws(()=>m1.map({...source,x:0,y:0}),/restore|legacy/i);
 assert.throws(()=>m1.map({...source,area:'unknown'}),/restore|legacy/i);
 const valid=m1.map(source);
 assert.throws(()=>m1.unmap({...valid,sequence:1}),/untouched/);
 const altered={...fixture.project,maps:{...fixture.project.maps,
  pod:{...fixture.project.maps.pod,rows:['#############',
    '#..#........#',...fixture.project.maps.pod.rows.slice(2)]}}};
 const badEngine=runtime(altered);
 const badMapper=makeMapper({engine:badEngine,mapping:fixture.mapping,
   legacyRestore:original.restore});
 const invalid=make();invalid.x=3;invalid.y=1;
 assert.ok(original.restore(JSON.stringify(invalid)));
 assert.throws(()=>badMapper.map(invalid),/Destination project rejected/);
});
test('original reference restore is mandatory and refuses altered source acceptance',()=>{
 assert.throws(()=>makeMapper({engine:e,mapping:fixture.mapping}),/restore/);
 const reject=makeMapper({engine:e,mapping:fixture.mapping,legacyRestore:()=>null});
 assert.throws(()=>reject.map(make()),/Original game-world restore/);
});
