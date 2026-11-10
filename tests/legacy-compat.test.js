const test=require('node:test'),assert=require('node:assert/strict');
const rules=require('../game/engine')(require('../game/world'));
const create=require('../framework/legacy-compat');
function setup(state){
 const legacy=state||rules.fresh('Saved original','Ivory');
 const source={expedition:JSON.stringify(legacy)};
 const disk=Object.create(null);
 let broken=false;
 const sourceAdapter={read:k=>Object.prototype.hasOwnProperty.call(source,k)?source[k]:null};
 const storage={read:k=>Object.prototype.hasOwnProperty.call(disk,k)?disk[k]:null,
   write:(k,v)=>{if(broken)return false;disk[k]=v;return true;}};
 const compat=()=>create({source:sourceAdapter,storage,original:rules});
 return {legacy,source,disk,storage,sourceAdapter,compat,setFailure:v=>broken=v};
}
function archive(f) {
 const vault=require('../framework/legacy-archive')(f.sourceAdapter,f.storage);
 assert.equal(vault.inspect().ok,true);
 assert.equal(vault.confirm().ok,true);
}
test('historical save remains unmodified during opt-in, durable compatibility play and restart',()=>{
 const f=setup(),original=f.source.expedition;
 const runner=f.compat();
 assert.equal(runner.preflight().reason,'backup-missing-or-invalid');
 assert.equal(runner.commit().reason,'not-staged');
 archive(f);
 assert.equal(runner.preflight().ok,true);
 assert.equal(runner.snapshot().active,false);
 assert.equal(runner.commit().ok,true);
 const first=f.compat();
 assert.equal(first.resume().ok,true);
 assert.equal(first.snapshot().sequence,0);
 let expected=rules.restore(original);
 for(const cmd of [{type:'move',value:'up'},{type:'move',value:'up'},
   {type:'move',value:'left'},{type:'move',value:'down'}]){
   const prev=expected;
   expected=rules.step(expected,cmd);
   const result=first.dispatch(cmd);
   assert.equal(result.ok,JSON.stringify(expected)!==JSON.stringify(prev));
   assert.deepEqual(first.snapshot().legacy,expected);
 }
 const after=f.compat();
 assert.equal(after.resume().ok,true);
 assert.deepEqual(after.snapshot().legacy,expected);
 assert.equal(f.source.expedition,original);
 assert.equal(f.compat().archive.exactCopy().raw,original);
 assert.equal(f.compat().preflight().reason,'destination-occupied');
});
test('all in-progress historical battle, gear, flags and prompts survive compatibility import',()=>{
 for(const kind of ['battle','prompt','equipment']){
  const s=rules.fresh('Exact state','Slate');
  s.area='gallery';s.x=8;s.y=4;s.weapon='lance';
  s.flags.bearing=true;s.hp=34;s.flags.E=true;s.flags.echoAlly=true;
  if(kind==='battle')s.battle={key:'H',hp:13,turn:6};
  if(kind==='prompt')s.prompt='H';
  const f=setup(s);archive(f);const c=f.compat();
  assert.equal(c.preflight().ok,true);
  assert.equal(c.commit().ok,true);
  assert.deepEqual(c.snapshot().legacy,s);
  const cmd=kind==='battle'?{type:'combat',value:'strike'}:
     kind==='prompt'?{type:'choose',value:'fight'}:{type:'move',value:'up'};
  const expected=rules.step(s,cmd);
  assert.equal(c.dispatch(cmd).ok,true);
  assert.deepEqual(c.snapshot().legacy,expected);
  assert.deepEqual(f.compat().resume(),{ok:true,reason:null,sequence:1});
  const restarted=f.compat();assert.equal(restarted.resume().ok,true);
  assert.deepEqual(restarted.snapshot().legacy,expected);
  assert.equal(f.source.expedition,JSON.stringify(s));
 }
});
test('source changes, occupied corrupt targets and write failures never replace original',()=>{
 let f=setup();archive(f);
 let c=f.compat();assert.equal(c.preflight().ok,true);
 f.source.expedition=JSON.stringify({...f.legacy,name:'Changed in old launcher'});
 assert.equal(c.commit().reason,'source-changed');
 assert.equal(c.snapshot().active,false);
 f=setup();archive(f);c=f.compat();
 f.disk[c.namespace+':a']='';
 assert.equal(c.preflight().reason,'destination-occupied');
 assert.equal(f.disk[c.namespace+':a'],'');
 f=setup();archive(f);c=f.compat();
 assert.equal(c.preflight().ok,true);f.setFailure(true);
 assert.equal(c.commit().reason,'write-failed');
 assert.equal(c.snapshot().active,false);
 f.setFailure(false);
 assert.equal(c.preflight().ok,true);assert.equal(c.commit().ok,true);
 const before=c.snapshot(),old=f.source.expedition;
 f.setFailure(true);
 assert.equal(c.dispatch({type:'move',value:'up'}).reason,'write-failed');
 assert.deepEqual(c.snapshot(),before);
 assert.equal(f.source.expedition,old);
});
test('old original engine combat has identical future transitions; no incompatible portable combat',()=>{
 const s=rules.fresh('Fighting','Ash');s.area='gallery';s.x=8;s.y=4;
 s.flags.E=true;s.flags.echoAlly=true;s.battle={key:'H',hp:23,turn:2};
 const f=setup(s);archive(f);const c=f.compat();c.preflight();c.commit();
 let target=JSON.parse(JSON.stringify(s));
 for(const value of ['guard','pulse','strike','strike','withdraw']){
   const cmd={type:'combat',value};
   const next=rules.step(target,cmd),before=JSON.stringify(target);
   const r=c.dispatch(cmd);target=next;
   assert.equal(r.ok,JSON.stringify(next)!==before);
   assert.deepEqual(c.snapshot().legacy,target);
 }
 assert.equal(f.source.expedition,JSON.stringify(s));
});
