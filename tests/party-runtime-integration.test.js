const test=require('node:test'),assert=require('node:assert/strict');
const create=require('../framework/runtime');
const makeSession=require('../framework/session');
const old=require('../fixtures/engine-project');
const project=require('../fixtures/party-engine-project');
const clone=x=>JSON.parse(JSON.stringify(x));
const encounter=e=>{
 let s=e.fresh('Combat test',33);
 for(const dir of ['down','down','right','right','up','up'])
  s=e.step(s,{type:'move',dir});
 return s;
};
const strike=(id,target)=>({actor:id,skill:'strike',target});
test('opt-in combat uses version 2 while existing projects retain unchanged v1 saves',()=>{
 const classic=create(old),v1=classic.fresh('Old',33);
 const engine=create(project),v2=engine.fresh('New',33);
 assert.equal(classic.version,1);
 assert.equal(v1.version,1);
 assert.equal('partyBattle' in v1,false);
 assert.equal(engine.version,2);
 assert.deepEqual(v2.allyStats,{});
 assert.equal(v2.partyBattle,null);
 assert.equal(engine.restore(JSON.stringify({...v2,version:1})),null);
 assert.equal(classic.restore(JSON.stringify(v1)).version,1);
});
test('party battle starts from world encounter using one canonical simulation',()=>{
 const e=create(project),s=encounter(e);
 assert.equal(s.sequence,6);
 assert.equal(s.battle,null);
 assert.equal(s.partyBattle.foe,'crawler');
 assert.equal(s.partyBattle.encounter.phase,'active');
 assert.equal(s.partyBattle.encounter.party[0].name,'Combat test');
 assert.equal(e.step(s,{type:'move',dir:'down'}),s);
 assert.equal(e.step(s,{type:'combat',id:'strike'}),s);
 assert.equal(e.step(s,{type:'party-round',orders:[]}),s);
 const next=e.step(s,{type:'party-round',orders:[strike('pilot','crawler')]});
 assert.equal(next.sequence,s.sequence+1);
 assert.ok(next.partyBattle.encounter.foes[0].hp<48);
 assert.equal(e.validateState(next),true);
 assert.deepEqual(e.restore(e.serialize(next)),next);
 assert.equal(s.partyBattle.encounter.foes[0].hp,48);
});
test('recruited allies get resource state and are required in party turn orders',()=>{
 const e=create(project),s=e.fresh('Pilot',17);
 s.allies.push('scout');s.allyStats.scout={hp:24,mp:2};
 assert.equal(e.validateState(s),true);
 let b=s;
 for(const dir of ['down','down','right','right','up','up'])
  b=e.step(b,{type:'move',dir});
 assert.equal(b.partyBattle.encounter.party.length,2);
 assert.equal(e.step(b,{type:'party-round',orders:[strike('pilot','crawler')]}),b);
 const n=e.step(b,{type:'party-round',orders:[
  strike('pilot','crawler'),strike('scout','crawler')]});
 assert.equal(n.sequence,b.sequence+1);
 assert.equal(n.partyBattle.encounter.party.length,2);
 assert.deepEqual(e.restore(e.serialize(n)),n);
});
test('the shared two-slot journal durably persists an active party round and rejects failed writes',()=>{
 const data=Object.create(null);let fail=false;
 const storage={read:k=>Object.prototype.hasOwnProperty.call(data,k)?data[k]:null,
  write:(k,v)=>{if(fail)return false;data[k]=v;return true;}};
 const opts={slotPrefix:'bf:framework-party-test:v2:test'};
 let session=makeSession(project,storage,null,opts);
 assert.equal(session.start('Pilot',55).ok,true);
 for(const dir of ['down','down','right','right','up','up'])
  assert.equal(session.dispatch({type:'move',dir}).ok,true);
 const snapshot=session.snapshot();
 assert.equal(snapshot.view.partyBattle.foe,'crawler');
 const before=session.serialize();
 fail=true;
 assert.equal(session.dispatch({type:'party-round',orders:[strike('pilot','crawler')]}).reason,'write-failed');
 assert.equal(session.serialize(),before);
 fail=false;
 assert.equal(session.dispatch({type:'party-round',orders:[strike('pilot','crawler')]}).ok,true);
 const committed=session.serialize();
 session=makeSession(project,storage,null,opts);
 assert.equal(session.resume().ok,true);
 assert.equal(session.serialize(),committed);
 assert.equal(session.snapshot().journal.latestSequence,7);
});
test('party victory clears encounter and awards experience without battle journal forks',()=>{
 const e=create(project);let s=encounter(e),revisions=0;
 while(s.partyBattle){
  s=e.step(s,{type:'party-round',orders:[{actor:'pilot',skill:'pulse',target:'crawler'}]});
  revisions++;
  assert.ok(revisions<12,'combat must terminate');
 }
 assert.ok(s.player.xp>0);
 assert.equal(s.flags['encounter:hub:3,1'],true);
 assert.equal(s.battle,null);
 assert.equal(s.sequence,6+revisions);
 assert.equal(e.restore(e.serialize(s)).sequence,s.sequence);
});
test('invalid party combat snapshot cannot pass engine restoration',()=>{
 const e=create(project),s=encounter(e),body=JSON.stringify(s);
 for(const v of [
  {...s,partyBattle:{...s.partyBattle,foe:'wrong'}},
  {...s,partyBattle:{...s.partyBattle,encounter:{...s.partyBattle.encounter,phase:'victory'}}},
  {...s,allyStats:{scout:{hp:999,mp:0}}},
  {...s,partyBattle:null,version:1}
 ])assert.equal(e.restore(JSON.stringify(v)),null);
 assert.ok(e.restore(body));
});
