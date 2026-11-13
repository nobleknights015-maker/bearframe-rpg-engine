'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const create=require('../framework/ui-preferences');
const makeRuntime=require('../framework/runtime');
const Slots=require('../framework/save-slots');
const project=require('../fixtures/party-world-project');
function disk(){
 const data=new Map();let writes=0,fail=false,corrupt=false;
 return {storage:{
   read:k=>data.has(k)?data.get(k):null,
   write:(k,v)=>{writes++;if(fail)return false;data.set(k,corrupt?v.slice(0,5):v);return true;}
 },data,writes:()=>writes,setFail:v=>fail=v,setCorrupt:v=>corrupt=v};
}
test('default UI preferences are stable, sound and four-way pad visible, no writes at startup',()=>{
 const d=disk(),p=create(d.storage,'framework-party-world-test');
 assert.deepEqual(p.snapshot(),{version:1,sequence:0,showPad:true,
   reducedMotion:false,muted:false,
   volumes:{master:100,music:80,sfx:100}});
 assert.equal(d.writes(),0);
 assert.equal(p.health().validSlots,0);
 assert.equal(p.keys.length,2);
 assert.ok(p.keys.every(k=>k.startsWith('bf:ui:framework-party-world-test:v1')));
});
test('UI preferences use two-slot atomic journal and survive process recreation',()=>{
 const d=disk(),p=create(d.storage,'framework-party-world-test');
 assert.equal(p.set('showPad',false).ok,true);
 assert.equal(p.set('reducedMotion',true).ok,true);
 assert.equal(p.set('muted',true).ok,true);
 assert.equal(p.volume('music',45).ok,true);
 assert.equal(p.volume('sfx',20).ok,true);
 assert.equal(p.snapshot().sequence,5);
 assert.equal(p.health().validSlots,2);
 const reloaded=create(d.storage,'framework-party-world-test');
 assert.deepEqual(reloaded.snapshot(),p.snapshot());
 assert.equal(reloaded.health().latestSequence,5);
 assert.equal(reloaded.snapshot().volumes.master,100);
});
test('invalid settings and impossible gain do not advance revision or write anything',()=>{
 const d=disk(),p=create(d.storage,'bearframe_test');
 const prev=p.snapshot();
 for(const [key,val] of [['showPad','no'],['unknown',true],['muted',0],
   ['volume',true]]){
   assert.equal(p.set(key,val).ok,false);
 }
 for(const [bus,val] of [['music',-1],['sfx',101],['master',1.5],['bogus',50]])
   assert.equal(p.volume(bus,val).ok,false);
 assert.equal(p.volume('music',80).unchanged,true);
 assert.deepEqual(p.snapshot(),prev);
 assert.equal(d.writes(),0);
});
test('failed native write cannot change visible settings or any saved RPG state',()=>{
 const d=disk(),p=create(d.storage,'framework-party-world-test');
 const engine=makeRuntime(JSON.parse(JSON.stringify(project)));
 const worldSave=Slots(engine,d.storage,'bf:framework-party-world-test:v2:diagnostics');
 const state=engine.fresh('Pilot',77);
 assert.equal(worldSave.save(state).ok,true);
 const gameBefore=d.data.get(worldSave.keys[0]);
 d.setFail(true);
 const before=p.snapshot();
 const result=p.set('showPad',false);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'write-failed');
 assert.deepEqual(p.snapshot(),before);
 d.setFail(false);
 assert.equal(d.data.get(worldSave.keys[0]),gameBefore);
 assert.equal(worldSave.load().sequence,0);
 assert.equal(p.set('showPad',false).ok,true);
 assert.equal(d.data.get(worldSave.keys[0]),gameBefore);
});
test('failed exact-byte readback cannot pretend settings saved',()=>{
 const d=disk(),p=create(d.storage,'owner_test');
 d.setCorrupt(true);
 const out=p.set('reducedMotion',true);
 assert.equal(out.ok,false);
 assert.equal(out.reason,'verify-failed');
 assert.equal(p.snapshot().reducedMotion,false);
 assert.equal(create(d.storage,'owner_test').snapshot().reducedMotion,false);
});
test('single corrupt slot recovers last valid preference generation',()=>{
 const d=disk(),p=create(d.storage,'owner_test');
 assert.equal(p.set('muted',true).ok,true);
 assert.equal(p.set('showPad',false).ok,true);
 const latest=p.snapshot();
 // Corrupt the newest slot only; old intact slot is recoverable.
 const key=p.keys.find(k=>JSON.parse(d.data.get(k)).sequence===2);
 d.data.set(key,'{BROKEN');
 const restored=create(d.storage,'owner_test');
 assert.equal(restored.snapshot().sequence,1);
 assert.equal(restored.snapshot().muted,true);
 assert.equal(restored.snapshot().showPad,true);
 assert.equal(restored.set('showPad',false).ok,true);
 assert.equal(restored.snapshot().sequence,2);
 assert.deepEqual(restored.snapshot(),latest);
});
test('fully corrupt or incompatible UI journal refuses silent overwrites',()=>{
 const d=disk(),p=create(d.storage,'owner_test');
 d.data.set(p.keys[0],'{BROKEN');
 d.data.set(p.keys[1],'bad');
 assert.equal(p.set('showPad',false).reason,'corrupt-settings');
 assert.equal(d.data.get(p.keys[0]),'{BROKEN');
 assert.equal(d.data.get(p.keys[1]),'bad');
 assert.equal(create(d.storage,'owner_test').health().occupiedSlots,2);
 assert.equal(create(d.storage,'owner_test').snapshot().showPad,true);
});
test('UI settings remain project-scoped, with no cross-game reading or modification',()=>{
 const d=disk(),one=create(d.storage,'project_one'),
   two=create(d.storage,'project_two');
 assert.equal(one.set('showPad',false).ok,true);
 assert.equal(two.snapshot().showPad,true);
 assert.equal(two.volume('master',25).ok,true);
 assert.equal(one.snapshot().volumes.master,100);
 const three=create(d.storage,'project_one');
 assert.equal(three.snapshot().showPad,false);
 assert.equal(three.snapshot().volumes.master,100);
});
test('UI preference project IDs reject invalid path segments and names',()=>{
 const d=disk();
 for(const id of ['../game','with space','',null,'-dash','UPPER','x'.repeat(65)])
   assert.throws(()=>create(d.storage,id),/UI preferences require/);
});
