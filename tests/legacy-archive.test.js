const test=require('node:test'),assert=require('node:assert/strict');
const create=require('../framework/legacy-archive');
const legacy=require('../framework/legacy-save-v1');
const old=require('../game/engine')(require('../game/world'));
function setup(){
 const s=old.fresh('Old frame','Slate'),source={expedition:JSON.stringify(s)};
 const disk=Object.create(null);let failure=false;
 return {source,disk,state:s,setFailure:v=>failure=v,
  sourceAdapter:{read:key=>Object.prototype.hasOwnProperty.call(source,key)?source[key]:null},
  storage:{read:key=>Object.prototype.hasOwnProperty.call(disk,key)?disk[key]:null,
   write:(key,val)=>{if(failure)return false;disk[key]=val;return true;}}};
}
test('read-only preflight, explicit confirmation and exact archival preserve legacy source byte for byte',()=>{
 const f=setup(),vault=create(f.sourceAdapter,f.storage),raw=f.source.expedition;
 assert.equal(vault.confirm().reason,'not-inspected');
 assert.equal(vault.audit().reason,'no-archive');
 const preview=vault.inspect();
 assert.equal(preview.ok,true);assert.equal(preview.summary.area,'pod');
 assert.equal(Object.keys(f.disk).length,0);
 assert.equal(vault.confirm().ok,true);
 assert.equal(f.source.expedition,raw);
 assert.equal(vault.exactCopy().raw,raw);
 assert.equal(create(f.sourceAdapter,f.storage).audit().sourceMatches,true);
 assert.equal(vault.inspect().reason,'archive-occupied');
 assert.equal(vault.confirm().reason,'not-inspected');
});
test('preserves battle, prompt, weapon, gear flags, location and original messages without conversion',()=>{
 const f=setup();
 f.state.area='gallery';f.state.x=8;f.state.y=4;f.state.hp=28;
 f.state.flags.bearing=true;f.state.weapon='lance';
 f.state.flags.E=true;f.state.flags.echoAlly=true;
 f.state.battle={key:'H',hp:14,turn:2};
 f.state.prompt=null;f.state.message='Exact original message';
 assert.ok(old.restore(JSON.stringify(f.state)));
 f.source.expedition=JSON.stringify(f.state);
 const v=create(f.sourceAdapter,f.storage);
 assert.equal(v.inspect().ok,true);
 assert.equal(v.confirm().ok,true);
 assert.deepEqual(legacy.decode(v.exactCopy().raw),f.state);
 assert.equal(v.audit().sourceMatches,true);
});
test('fail-closed source changes, malformed world tiles and occupied backup never overwrite',()=>{
 const f=setup(),v=create(f.sourceAdapter,f.storage);
 assert.equal(v.inspect().ok,true);
 f.source.expedition=JSON.stringify({...f.state,name:'Changed'});
 assert.equal(v.confirm().reason,'source-changed');
 assert.equal(Object.keys(f.disk).length,0);
 f.source.expedition=JSON.stringify({...f.state,x:0,y:0});
 assert.equal(v.inspect().reason,'invalid-legacy-save');
 assert.equal(Object.keys(f.disk).length,0);
 f.source.expedition=JSON.stringify(f.state);
 f.disk['bf:legacy-v1-archive:v1:backup:a']='';
 assert.equal(v.inspect().reason,'archive-occupied');
 assert.equal(v.confirm().reason,'not-inspected');
 assert.equal(f.disk['bf:legacy-v1-archive:v1:backup:a'],'');
});
test('failed or falsely acknowledged writes do not report a verified archive',()=>{
 const f=setup();f.setFailure(true);
 let v=create(f.sourceAdapter,f.storage);
 assert.equal(v.inspect().ok,true);assert.equal(v.confirm().reason,'write-failed');
 f.setFailure(false);
 let alternate={read:f.storage.read,write:()=>true};
 v=create(f.sourceAdapter,alternate);
 assert.equal(v.inspect().ok,true);assert.equal(v.confirm().reason,'verify-failed');
 assert.equal(Object.keys(f.disk).length,0);
});
test('archived copy remains independently recoverable if legacy launcher advances later',()=>{
 const f=setup(),v=create(f.sourceAdapter,f.storage),saved=f.source.expedition;
 assert.equal(v.inspect().ok,true);assert.equal(v.confirm().ok,true);
 f.source.expedition=JSON.stringify({...f.state,name:'Advanced'});
 let read=v.audit();
 assert.equal(read.ok,true);assert.equal(read.sourceMatches,false);
 assert.equal(read.sourceAccessible,true);
 assert.equal(v.exactCopy().raw,saved);
 assert.equal(v.inspect().reason,'archive-occupied');
});
test('archive constructor and corrupt destination fail closed without source write',()=>{
 const f=setup();
 assert.throws(()=>create({read:null},f.storage),/source/);
 const v=create(f.sourceAdapter,f.storage);
 assert.equal(v.inspect().ok,true);assert.equal(v.confirm().ok,true);
 const key='bf:legacy-v1-archive:v1:backup:a';
 const altered=f.disk[key].slice(0,-1);
 f.disk[key]=altered;
 assert.equal(v.audit().reason,'unreadable-archive');
 assert.equal(v.exactCopy().ok,false);
 assert.equal(typeof f.source.expedition,'string');
});
