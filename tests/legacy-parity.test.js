const test=require('node:test'),assert=require('node:assert/strict');
const old=require('../game/engine')(require('../game/world'));
const engine=require('../framework/runtime')(require('../fixtures/legacy-migration-project').project);
const mapping=require('../fixtures/legacy-migration-project').mapping;
const mapper=require('../framework/legacy-v1-mapper')({engine,mapping,legacyRestore:old.restore});
const make=require('../framework/legacy-parity');
const probe=make({legacyStep:old.step,legacyRestore:old.restore,engine,mapper});
test('legacy parity probe compares all historical fields without touching any save storage',()=>{
 const s=old.fresh('Replay','Slate'),raw=JSON.stringify(s);
 const a=probe.compare(s,{type:'move',value:'up'},{type:'move',dir:'up'});
 assert.deepEqual(a,{ok:true,reason:null,changed:true});
 assert.equal(JSON.stringify(s),raw);
 assert.deepEqual(probe.audit([{state:s,
   legacyCommand:{type:'move',value:'up'},targetCommand:{type:'move',dir:'up'}}]),
   {ok:true,reason:null,checked:1,changed:1});
});
test('incompatible legacy choices reject playable conversion even if all saved fields round-trip',()=>{
 const s=old.fresh('Replay','Ash');s.prompt='C';
 assert.ok(old.restore(JSON.stringify(s)));
 const a=probe.compare(s,{type:'choose',value:'fit'},{type:'choose',id:'fit'});
 assert.equal(a.ok,false);
 assert.equal(a.reason,'behavior-mismatch');
 const scenarios=[
  {state:old.fresh('Replay','Ash'),legacyCommand:{type:'move',value:'up'},
    targetCommand:{type:'move',dir:'up'}},
  {state:s,legacyCommand:{type:'choose',value:'fit'},targetCommand:{type:'choose',id:'fit'}}
 ];
 assert.deepEqual(probe.audit(scenarios),{ok:false,reason:'behavior-mismatch',
   checked:2,changed:1,index:1});
});
test('combat rule drift rejects an otherwise reversible battle snapshot',()=>{
 const s=old.fresh('Combat','Ivory');
 s.area='gallery';s.x=8;s.y=4;s.battle={key:'H',hp:24,turn:1};
 assert.ok(old.restore(JSON.stringify(s)));
 const a=probe.compare(s,{type:'combat',value:'strike'},{type:'combat',id:'strike'});
 assert.equal(a.ok,false);
 assert.equal(a.reason,'behavior-mismatch');
});
test('parity audit rejects empty, invalid and no-op-only scenario suites',()=>{
 assert.equal(probe.audit([]).reason,'no-scenarios');
 assert.equal(probe.compare(null,{type:'move',value:'up'},{type:'move',dir:'up'}).ok,false);
 const state=old.fresh('Replay','Ash');
 const x=probe.audit([{state,legacyCommand:{type:'move',value:'banana'},
   targetCommand:{type:'move',dir:'banana'}}]);
 assert.equal(x.reason,'no-changing-scenarios');
 assert.equal(x.ok,false);
});
