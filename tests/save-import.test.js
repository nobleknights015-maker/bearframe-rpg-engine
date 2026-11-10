const test=require('node:test'),assert=require('node:assert/strict');
const importer=require('../framework/save-import');
const engineFactory=require('../framework/runtime');
const journalFactory=require('../framework/save-slots');
const project=require('../fixtures/engine-project');
function setup(){
 const engine=engineFactory(project),sourceData={legacy:'{"name":"Old","seed":19}'};
 const disk=Object.create(null);
 const source={read:k=>sourceData[k]||null};
 const storage={read:k=>Object.prototype.hasOwnProperty.call(disk,k)?disk[k]:null,
   write:(k,v)=>{disk[k]=v;return true;}};
 const destination=journalFactory(engine,storage,'bf:import-test:v1');
 const config={source,sourceKey:'legacy',destination,engine,
   decode:JSON.parse,map:old=>engine.fresh(old.name,old.seed)};
 return {engine,sourceData,disk,destination,config};
}
test('explicit inspect and commit preserve legacy bytes and verify durable destination',()=>{
 const s=setup(),before=s.sourceData.legacy;
 const i=importer(s.config);
 assert.equal(i.commit().reason,'not-staged');
 assert.deepEqual(i.inspect(),{ok:true,reason:null,sequence:0});
 assert.equal(Object.keys(s.disk).length,0);
 assert.equal(i.commit().ok,true);
 assert.equal(s.sourceData.legacy,before);
 assert.equal(s.destination.health().validSlots,1);
 assert.equal(s.destination.load().sequence,0);
 assert.equal(i.commit().reason,'not-staged');
 assert.equal(i.inspect().reason,'destination-occupied');
});
test('destination occupancy, including corrupted slots, fails closed',()=>{
 const s=setup();
 s.disk['bf:import-test:v1:a']='corrupt';
 const i=importer(s.config);
 assert.equal(i.inspect().reason,'destination-occupied');
 assert.equal(i.commit().reason,'not-staged');
 assert.equal(s.disk['bf:import-test:v1:a'],'corrupt');
});
test('source mutation after inspection invalidates staged import',()=>{
 const s=setup(),i=importer(s.config);
 assert.equal(i.inspect().ok,true);
 s.sourceData.legacy='{"name":"Changed","seed":20}';
 assert.equal(i.commit().reason,'source-changed');
 assert.equal(Object.keys(s.disk).length,0);
});
test('source errors and invalid mapping never write a destination',()=>{
 const s=setup();
 let i=importer({...s.config,source:{read:()=>{throw Error('locked');}}});
 assert.equal(i.inspect().reason,'source-unreadable');
 i=importer({...s.config,map:()=>({sequence:0,not:'a valid engine state'})});
 assert.equal(i.inspect().reason,'mapping-failed');
 i=importer({...s.config,sourceKey:'missing'});
 assert.equal(i.inspect().reason,'source-missing');
 assert.equal(Object.keys(s.disk).length,0);
});
test('failed writes and occupied destination between phases do not overwrite saves',()=>{
 const s=setup(),i=importer(s.config);
 assert.equal(i.inspect().ok,true);
 s.disk['bf:import-test:v1:b']='unreadable';
 assert.equal(i.commit().reason,'destination-occupied');
 assert.equal(s.disk['bf:import-test:v1:b'],'unreadable');
 const t=setup(),j=importer({...t.config,destination:journalFactory(t.engine,{
   read:k=>t.disk[k]||null,write:()=>false},'bf:import-test:v1')});
 assert.equal(j.inspect().ok,true);
 assert.equal(j.commit().reason,'write-failed');
 assert.equal(Object.keys(t.disk).length,0);
});
test('rejects implicit namespace, absent decoder and invalid source keys',()=>{
 const s=setup();
 assert.throws(()=>importer({...s.config,sourceKey:'../legacy'}),/source key/);
 assert.throws(()=>importer({...s.config,decode:null}),/decoder/);
});

test('empty strings and non-string destination values are occupied, never import targets',()=>{
 for(const value of ['',0,false,{},[]]){
  const s=setup();
  s.disk['bf:import-test:v1:a']=value;
  const i=importer(s.config);
  assert.equal(i.inspect().reason,'destination-occupied');
  assert.equal(i.commit().reason,'not-staged');
  assert.strictEqual(s.disk['bf:import-test:v1:a'],value);
  assert.equal(s.disk['bf:import-test:v1:b'],undefined);
 }
});
test('destination becomes empty-string occupied after inspection and blocks commit',()=>{
 const s=setup(),i=importer(s.config);
 assert.equal(i.inspect().ok,true);
 s.disk['bf:import-test:v1:b']='';
 assert.equal(i.commit().reason,'destination-occupied');
 assert.equal(s.disk['bf:import-test:v1:b'],'');
 assert.equal(s.disk['bf:import-test:v1:a'],undefined);
});

test('unavailable journal health fails closed during inspection without source reads or writes',()=>{
 const s=setup();let reads=0;
 const destination={health:()=>{throw Error('storage unavailable');},save:()=>{throw Error('must not save');}};
 const i=importer({...s.config,source:{read:()=>{reads++;return s.sourceData.legacy;}},destination});
 assert.deepEqual(i.inspect(),{ok:false,reason:'destination-occupied'});
 assert.equal(reads,0);
 assert.equal(Object.keys(s.disk).length,0);
});
test('health failure after staging cancels import and never retries a stale plan',()=>{
 const s=setup();let broken=false,saves=0;
 const destination={health:()=>broken?(()=>{throw Error('disk inaccessible')})():s.destination.health(),
   save:state=>{saves++;return s.destination.save(state);},load:()=>s.destination.load()};
 const i=importer({...s.config,destination});
 assert.equal(i.inspect().ok,true);
 broken=true;
 assert.equal(i.commit().reason,'destination-occupied');
 broken=false;
 assert.equal(i.commit().reason,'not-staged');
 assert.equal(saves,0);
 assert.equal(Object.keys(s.disk).length,0);
});
test('ambiguous or incomplete health reports never authorize import',()=>{
 const s=setup();
 for(const report of [null,{}, {conflict:false,occupiedSlots:0},
   {conflict:false,occupiedSlots:0,validSlots:0.0,unexpected:true,}]) {
   // A complete report with extra diagnostic keys is allowed.
   const expected=report&&report.conflict===false&&report.occupiedSlots===0&&report.validSlots===0;
   const i=importer({...s.config,destination:{health:()=>report,save:()=>{throw Error('unexpected');}}});
   assert.equal(i.inspect().ok,!!expected);
 }
 assert.equal(Object.keys(s.disk).length,0);
});
