const test=require('node:test'),assert=require('node:assert/strict');
const old=require('../game/engine')(require('../game/world'));
const runtime=require('../framework/runtime');
const fixture=require('../fixtures/legacy-migration-project');
const archive=require('../framework/legacy-archive');
const create=require('../framework/legacy-migration');
function setup(){
 const legacy=old.fresh('Migrating frame','Ivory');
 legacy.flags.bearing=true;legacy.hp=34;legacy.weapon='blade';
 legacy.flags.E=true;legacy.flags.echoAlly=true;
 legacy.area='gallery';legacy.x=4;legacy.y=1;
 legacy.prompt='E';
 const raw=JSON.stringify(legacy),sourceData={expedition:raw};
 const disk=Object.create(null);let fault=false;
 const source={read:key=>Object.prototype.hasOwnProperty.call(sourceData,key)?sourceData[key]:null};
 const storage={
  read:key=>Object.prototype.hasOwnProperty.call(disk,key)?disk[key]:null,
  write:(key,val)=>{if(fault)return false;disk[key]=val;return true;}
 };
 const config={source,storage,engine:runtime(fixture.project),
  mapping:fixture.mapping,legacyRestore:old.restore,
  targetPrefix:'bf:migration-compat-test:v1:verified'};
 return {legacy,raw,sourceData,disk,source,storage,config,setFault:x=>fault=x};
}
test('conversion refuses unarchived source and never creates a playable save implicitly',()=>{
 const f=setup(),m=create(f.config);
 assert.deepEqual(m.status(),{backup:'missing-or-invalid',destination:'empty',conflict:false});
 assert.equal(m.preflight().reason,'backup-missing-or-invalid');
 assert.equal(m.commit().reason,'not-staged');
 assert.equal(Object.keys(f.disk).length,0);
});
test('full import requires verified archived source, user staging and exact reversibility',()=>{
 const f=setup(),b=archive(f.source,f.storage),m=create(f.config);
 assert.equal(b.inspect().ok,true);assert.equal(b.confirm().ok,true);
 assert.equal(m.preflight().ok,true);
 assert.equal(m.status().destination,'empty');
 assert.equal(m.commit().ok,true);
 assert.equal(m.status().destination,'populated');
 assert.equal(m.status().backup,'matches');
 assert.equal(m.archivedOriginal().raw,f.raw);
 assert.equal(f.sourceData.expedition,f.raw);
 assert.equal(m.preflight().reason,'destination-occupied');
});
test('changed original between preflight and commit blocks upgrade; backup remains safe',()=>{
 const f=setup(),b=archive(f.source,f.storage),m=create(f.config);
 assert.equal(b.inspect().ok,true);assert.equal(b.confirm().ok,true);
 assert.equal(m.preflight().ok,true);
 f.sourceData.expedition=JSON.stringify({...f.legacy,name:'Updated old launcher'});
 assert.equal(m.commit().reason,'backup-source-diverged');
 assert.equal(m.status().destination,'empty');
 assert.equal(m.status().backup,'source-diverged');
 assert.equal(m.archivedOriginal().raw,f.raw);
});
test('occupied target, failed commit and damaged backup do not modify original',()=>{
 let f=setup(),b=archive(f.source,f.storage),m=create(f.config);
 b.inspect();assert.equal(b.confirm().ok,true);
 f.disk['bf:migration-compat-test:v1:verified:a']='';
 assert.equal(m.preflight().reason,'destination-occupied');
 assert.equal(f.disk['bf:migration-compat-test:v1:verified:a'],'');
 f=setup();b=archive(f.source,f.storage);m=create(f.config);
 b.inspect();assert.equal(b.confirm().ok,true);
 assert.equal(m.preflight().ok,true);
 f.setFault(true);
 assert.equal(m.commit().reason,'write-failed');
 assert.equal(m.status().destination,'empty');
 f.setFault(false);
 const key='bf:legacy-v1-archive:v1:backup:a';
 f.disk[key]='broken';
 assert.equal(m.preflight().reason,'backup-missing-or-invalid');
 assert.equal(f.sourceData.expedition,f.raw);
});
test('migration rejects invalid namespace and missing original restore',()=>{
 const f=setup();
 assert.throws(()=>create({...f.config,targetPrefix:'bf:bad:wrong'}),/namespace/);
 assert.throws(()=>create({...f.config,legacyRestore:null}),/original restore/);
});
