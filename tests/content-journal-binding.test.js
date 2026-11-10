const test=require('node:test'),assert=require('node:assert/strict');
const make=require('../framework/runtime'),slots=require('../framework/save-slots'),
  session=require('../framework/session'),fingerprint=require('../framework/content-contract'),
  schema=require('../framework/schema'),original=require('../fixtures/engine-project');
const clone=x=>JSON.parse(JSON.stringify(x));
const project=r=>{const p=clone(original);if(r!==undefined)p.contentRevision=r;return p;};
function disk(){const data=Object.create(null);return {
 data,read:k=>Object.prototype.hasOwnProperty.call(data,k)?data[k]:null,
 write:(k,v)=>{data[k]=v;return true;}
};}
test('untagged v1 journal retains exact legacy envelope shape',()=>{
 const e=make(project()),mem=disk(),j=slots(e,mem);
 assert.equal(e.contentTag,null);
 assert.equal(j.save(e.fresh('Old',41)).ok,true);
 assert.equal(Object.prototype.hasOwnProperty.call(JSON.parse(mem.data[j.keys[0]]),'contentTag'),false);
 assert.equal(slots(make(project()),mem).load().sequence,0);
});
test('opt-in project content fingerprint is deterministic across object key insertion order',()=>{
 const p=project('r1'),e=make(p),mem=disk(),j=slots(e,mem);
 assert.match(e.contentTag,/^v1:r1:[0-9a-f]{16}$/);
 assert.equal(j.save(e.fresh('Pilot',41)).ok,true);
 assert.equal(JSON.parse(mem.data[j.keys[0]]).contentTag,e.contentTag);
 const shuffled={...p,items:Object.fromEntries(Object.entries(p.items).reverse()),
  maps:Object.fromEntries(Object.entries(p.maps).reverse())};
 assert.equal(fingerprint(shuffled),e.contentTag);
 assert.deepEqual(slots(make(shuffled),mem).load(),e.fresh('Pilot',41));
});
test('changed map, effects, items, combat or revision cannot read or overwrite previous save',()=>{
 const base=project('r1'),safe=make(base),mem=disk(),j=slots(safe,mem);
 assert.equal(j.save(safe.fresh('Keep',19)).ok,true);
 const bytes=JSON.stringify(mem.data);
 for(const mutate of [
  p=>p.contentRevision='r2',
  p=>p.rules={baseAttack:22},
  p=>p.items.blade.power=10,
  p=>p.foes.crawler.attack=9,
  p=>p.events.supply.choices[0].effects[0].qty=2,
  p=>p.maps.hub.rows[2]='#...#.#'
 ]){
  const p=project('r1');mutate(p);schema(p);
  const next=make(p),other=slots(next,mem);
  assert.notEqual(next.contentTag,safe.contentTag);
  assert.equal(other.health().contentMismatch,true);
  assert.equal(other.load(),null);
  assert.equal(other.save(next.fresh('Unsafe',19)).reason,'content-mismatch');
  const s=session(p,mem,null);
  assert.equal(s.resume().reason,'incompatible-content');
  assert.equal(s.start('Unsafe').reason,'incompatible-content');
  assert.equal(JSON.stringify(mem.data),bytes);
 }
});
test('old and content-bound journals refuse mixing in either direction',()=>{
 const raw=make(project()),versioned=make(project('r1'));
 for(const [first,second] of [[raw,versioned],[versioned,raw]]){
  const mem=disk(),a=slots(first,mem),b=slots(second,mem);
  assert.equal(a.save(first.fresh('Stored',3)).ok,true);
  const before=JSON.stringify(mem.data);
  assert.equal(b.health().contentMismatch,true);
  assert.equal(b.load(),null);
  assert.equal(b.save(second.fresh('Other',3)).reason,'content-mismatch');
  assert.equal(JSON.stringify(mem.data),before);
 }
});
test('mixed matching and mismatched slots fail closed instead of replaying stale data',()=>{
 const e=make(project('r1')),f=make(project('r2')),mem=disk(),a=slots(e,mem),alt=disk(),b=slots(f,alt);
 let s=e.fresh('Keep',33);assert.equal(a.save(s).ok,true);
 s=e.step(s,{type:'move',dir:'down'});assert.equal(a.save(s).ok,true);
 assert.equal(b.save(f.fresh('Foreign',33)).ok,true);
 mem.data[a.keys[0]]=alt.data[b.keys[0]];
 const unchanged=JSON.stringify(mem.data);
 assert.equal(a.health().contentMismatch,true);
 assert.equal(a.load(),null);
 assert.equal(a.save(e.step(s,{type:'move',dir:'up'})).reason,'content-mismatch');
 assert.equal(JSON.stringify(mem.data),unchanged);
});
test('versioned session survives restart without new state fields',()=>{
 const p=project('release_1'),mem=disk(),opts={slotPrefix:'bf:content-contract:v1:test'};
 let s=session(p,mem,null,opts);
 assert.equal(s.start('New',31).ok,true);
 assert.equal(s.dispatch({type:'move',dir:'down'}).ok,true);
 const serialized=s.serialize();
 assert.equal(Object.prototype.hasOwnProperty.call(JSON.parse(serialized),'contentTag'),false);
 s=session(p,mem,null,opts);
 assert.equal(s.resume().ok,true);
 assert.equal(s.serialize(),serialized);
 assert.equal(s.verifySave().ok,true);
});
test('content revisions are validated as stable lowercase IDs',()=>{
 for(const rev of ['',null,7,'Release 1','../','A'.repeat(65)])
  assert.throws(()=>make(project(rev)),/contentRevision/);
});
test('browser and Rhino load contract before runtime',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const html=read('enginehost/index.html'),ci=read('.github/workflows/engine-ci.yml');
 assert.ok(html.indexOf('framework/content-contract.js')<html.indexOf('framework/runtime.js'));
 assert.match(ci,/-f framework\/content-contract\.js -f framework\/runtime\.js/);
});
