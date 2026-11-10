const test=require('node:test'),assert=require('node:assert/strict');
const old=require('../game/engine')(require('../game/world'));
const create=require('../framework/legacy-compat');
function fixture(original,initial){
  const legacy=original||old.fresh('Old launcher','Ash');
  const source={expedition:JSON.stringify(legacy)};
  const disk=Object.assign(Object.create(null),initial||{});
  let rejectWrites=false;
  const storage={read:k=>Object.hasOwn(disk,k)?disk[k]:null,
    write:(k,v)=>{if(rejectWrites)return false;disk[k]=v;return true;}};
  const compat=()=>create({source:{read:k=>k==='expedition'?source.expedition:null},
    storage,original:old});
  return {source,disk,compat,fail:v=>rejectWrites=v};
}
test('external progressed legacy JSON can be explicitly restored to empty isolated journal without touching old launcher',()=>{
  const advanced=old.fresh('Continued','Ivory');
  advanced.area='gallery';advanced.x=8;advanced.y=4;
  advanced.weapon='lance';advanced.flags.bearing=true;advanced.hp=35;
  advanced.battle={key:'H',hp:9,turn:3};
  assert.ok(old.restore(JSON.stringify(advanced)));
  const raw=JSON.stringify(advanced),f=fixture();
  const existing=f.source.expedition,c=f.compat();
  assert.equal(c.commitFile().reason,'not-staged');
  assert.equal(c.inspectFile(raw).ok,true);
  assert.equal(c.snapshot().active,false);
  assert.equal(Object.keys(f.disk).length,0);
  assert.equal(c.commitFile().ok,true);
  assert.equal(f.source.expedition,existing);
  assert.equal(Object.keys(f.disk).length,1);
  const reloaded=f.compat();assert.equal(reloaded.resume().ok,true);
  assert.deepEqual(reloaded.snapshot().legacy,advanced);
  const expected=old.step(advanced,{type:'combat',value:'strike'});
  assert.equal(reloaded.dispatch({type:'combat',value:'strike'}).ok,true);
  assert.deepEqual(reloaded.snapshot().legacy,expected);
  assert.equal(f.source.expedition,existing);
  assert.equal(reloaded.inspectFile(raw).reason,'destination-occupied');
});
test('fresh install can import without original Rhino source or archive',()=>{
  const legacy=old.fresh('Portable file','Slate'),raw=JSON.stringify(legacy),f=fixture();
  delete f.source.expedition;
  const c=f.compat();
  assert.equal(c.preflight().reason,'backup-missing-or-invalid');
  assert.equal(c.inspectFile(raw).ok,true);
  assert.equal(c.commitFile().ok,true);
  assert.deepEqual(f.compat().resume(),{ok:true,reason:null,sequence:0});
  assert.equal(f.source.expedition,undefined);
});
test('malformed, invalid geometry, future and oversized saves fail without disk writes',()=>{
  const valid=old.fresh('Valid','Slate'),f=fixture(),c=f.compat();
  for(const raw of ['',null,'?',JSON.stringify({...valid,area:'future'}),
     JSON.stringify({...valid,x:0,y:0}),JSON.stringify({...valid,extra:1}),
     JSON.stringify({...valid,hp:500}),'z'.repeat(1900001)]){
    assert.equal(c.inspectFile(raw).ok,false);
    assert.equal(c.commitFile().reason,'not-staged');
    assert.equal(Object.keys(f.disk).length,0);
  }
});
test('staged external save cannot overwrite corrupt or concurrently appearing journal data',()=>{
 const raw=JSON.stringify(old.fresh('Protect','Ash')),f=fixture(),c=f.compat();
 assert.equal(c.inspectFile(raw).ok,true);
 f.disk[c.namespace+':a']='';
 assert.equal(c.commitFile().reason,'destination-occupied');
 assert.equal(f.disk[c.namespace+':a'],'');
 assert.equal(c.commitFile().reason,'not-staged');
 const fail=fixture(),again=fail.compat();
 assert.equal(again.inspectFile(raw).ok,true);
 fail.fail(true);
 assert.equal(again.commitFile().reason,'write-failed');
 assert.equal(again.snapshot().active,false);
 fail.fail(false);
 assert.equal(again.inspectFile(raw).ok,true);
 assert.equal(again.commitFile().ok,true);
});
test('source-preflight and file-preflight never cross-authorize the other commit',()=>{
 const f=fixture(),raw=f.source.expedition;
 const vault=require('../framework/legacy-archive')({read:k=>k==='expedition'?raw:null},
   {read:k=>Object.hasOwn(f.disk,k)?f.disk[k]:null,write:(k,v)=>{f.disk[k]=v;return true;}});
 assert.equal(vault.inspect().ok,true);assert.equal(vault.confirm().ok,true);
 const c=f.compat();
 assert.equal(c.preflight().ok,true);
 assert.equal(c.inspectFile(raw).ok,true);
 assert.equal(c.commit().reason,'not-staged');
 assert.equal(c.preflight().ok,true);
 assert.equal(c.commitFile().reason,'not-staged');
 assert.equal(c.commit().ok,true);
});
