const test=require('node:test'),assert=require('node:assert/strict');
const create=require('../framework/runtime'),slots=require('../framework/save-slots'),definition=require('../fixtures/engine-project');
const engine=create(definition);
const memory=()=>{
  const data={};let fail=false,truncate=false,forget=false;
  return {data,read:key=>data[key]??null,write:(key,value)=>{
    if(fail)return false;
    if(!forget)data[key]=truncate?value.slice(0,Math.max(1,value.length-10)):value;
    return true;
  },setFailure:v=>fail=v,setTruncate:v=>truncate=v,setForget:v=>forget=v};
};
test('writes first state into first slot and next revision into the alternate slot',()=>{
  const mem=memory(),journal=slots(engine,mem);
  const first=engine.fresh('Pilot',37);
  assert.equal(journal.load(),null);
  assert.equal(journal.health().validSlots,0);
  assert.equal(journal.save(first).ok,true);
  assert.equal(journal.health().validSlots,1);
  assert.deepEqual(journal.load(),first);
  const second=engine.step(first,{type:'move',dir:'down'});
  const result=journal.save(second);
  assert.equal(result.ok,true);
  assert.equal(result.unchanged,false);
  assert.equal(journal.health().validSlots,2);
  assert.equal(journal.health().latestSequence,1);
  assert.deepEqual(slots(engine,mem).load(),second);
  assert.equal(journal.save(second).unchanged,true);
});
test('rejects stale writes and divergent same-sequence payloads',()=>{
  const mem=memory(),j=slots(engine,mem),initial=engine.fresh('Pilot',11);
  assert.equal(j.save(initial).ok,true);
  const next=engine.step(initial,{type:'move',dir:'down'});
  assert.equal(j.save(next).ok,true);
  assert.equal(j.save(initial).reason,'stale');
  const alternate=engine.step(initial,{type:'move',dir:'right'});
  assert.equal(alternate.sequence,next.sequence);
  assert.equal(j.save(alternate).reason,'conflict');
  assert.deepEqual(j.load(),next);
});
test('a damaged newest slot recovers the earlier committed state',()=>{
  const mem=memory(),j=slots(engine,mem),old=engine.fresh('Pilot',3);
  assert.equal(j.save(old).ok,true);
  const next=engine.step(old,{type:'move',dir:'down'});
  assert.equal(j.save(next).ok,true);
  mem.data[j.keys[1]]='{"truncated":';
  assert.deepEqual(slots(engine,mem).load(),old);
  assert.equal(j.health().validSlots,1);
  const repaired=engine.step(old,{type:'move',dir:'right'});
  assert.equal(j.save(repaired).ok,true);
  assert.deepEqual(j.load(),repaired);
});
test('failed write and lost write never report a durable commit',()=>{
  const mem=memory(),j=slots(engine,mem),s=engine.fresh('Pilot');
  mem.setFailure(true);
  assert.equal(j.save(s).reason,'write-failed');
  assert.equal(j.load(),null);
  mem.setFailure(false);mem.setForget(true);
  assert.equal(j.save(s).reason,'verify-failed');
  assert.equal(j.load(),null);
  mem.setForget(false);mem.setTruncate(true);
  assert.equal(j.save(s).reason,'verify-failed');
  assert.equal(j.load(),null);
  mem.setTruncate(false);
  assert.equal(j.save(s).ok,true);
});
test('invalid save payload, checksum and game identifiers are rejected',()=>{
  const mem=memory(),j=slots(engine,mem),s=engine.fresh('Pilot');
  assert.equal(j.save(s).ok,true);
  const row=JSON.parse(mem.data[j.keys[0]]);
  row.project='other';mem.data[j.keys[0]]=JSON.stringify(row);
  assert.equal(j.load(),null);
  assert.equal(j.health().validSlots,0);
  assert.equal(j.save({...s,version:0}).reason,'invalid-state');
  assert.equal(j.save(s).ok,true);
  const broken=JSON.parse(mem.data[j.keys[0]]);broken.checksum='ffffffff';
  mem.data[j.keys[0]]=JSON.stringify(broken);
  assert.equal(j.load(),null);
});
test('same-revision forks fail closed instead of silently choosing a branch',()=>{
  const leftMem=memory(),rightMem=memory();
  const a=engine.fresh('Pilot A',9),b=engine.fresh('Pilot B',9);
  const left=slots(engine,leftMem),right=slots(engine,rightMem);
  assert.equal(left.save(a).ok,true);assert.equal(right.save(b).ok,true);
  leftMem.data[left.keys[1]]=rightMem.data[right.keys[0]];
  assert.equal(left.health().conflict,true);
  assert.equal(left.load(),null);
  assert.equal(left.save(engine.step(a,{type:'move',dir:'down'})).reason,'conflict');
});
test('write failure cannot silently show a newly advanced persisted turn',()=>{
  const mem=memory(),journal=slots(engine,mem),initial=engine.fresh('Pilot',21);
  assert.equal(journal.save(initial).ok,true);
  const next=engine.step(initial,{type:'move',dir:'down'});
  mem.setFailure(true);
  const result=journal.save(next);
  assert.equal(result.ok,false);
  assert.deepEqual(journal.load(),initial);
});
