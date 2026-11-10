const test=require('node:test'),assert=require('node:assert/strict');
const createProbe=require('../enginehost/party-probe');
const fs=require('node:fs'),path=require('node:path');
const storage=()=>{
 const data=Object.create(null);
 return {read:k=>Object.prototype.hasOwnProperty.call(data,k)?data[k]:null,
 write:(k,v)=>{data[k]=v;return true;}};
};
test('offline v2 party integration uses its own durable journal across process recreation',()=>{
 const disk=storage(),probe=createProbe(disk);
 assert.deepEqual(Object.assign({},probe.snapshot()),{
  ready:true,error:null,engineVersion:2,sequence:0,phase:'none',
  targetHp:null,partyCount:null,playerHp:null,savedRevision:0,validSlots:1
 });
 assert.equal(probe.begin().ok,true);
 assert.equal(probe.snapshot().sequence,6);
 assert.equal(probe.snapshot().phase,'active');
 assert.equal(probe.round().ok,true);
 const before=probe.snapshot();
 assert.equal(before.sequence,7);
 assert.equal(before.validSlots,2);
 const resumed=createProbe(disk);
 assert.deepEqual(resumed.snapshot(),before);
 assert.equal(resumed.round().ok,true);
 assert.equal(resumed.snapshot().sequence,8);
});
test('synthetic party UI and separate namespaces are wired into actual Android host',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../enginehost/index.html'),'utf8');
 const boot=fs.readFileSync(path.join(__dirname,'../enginehost/boot.js'),'utf8');
 const build=fs.readFileSync(path.join(__dirname,'../android/build.sh'),'utf8');
 const java=fs.readFileSync(path.join(__dirname,'../android/test/RouteRunner.java'),'utf8');
 const ci=fs.readFileSync(path.join(__dirname,'../.github/workflows/engine-ci.yml'),'utf8');
 assert.match(html,/party-probe\.js/);
 assert.match(html,/party-engine-project\.js/);
 assert.match(html,/framework\/party-runtime\.js/);
 assert.match(html,/id="party-start"/);
 assert.match(html,/id="party-round"/);
 assert.match(boot,/createBearframePartyProbe\(storage\)/);
 assert.match(boot,/party:partyProbe/);
 assert.match(build,/fixtures\/\*\.js/);
 assert.match(java,/checkUnifiedParty\(boolean second\)/);
 assert.match(java,/stage\.equals\("unified-party-second"\)/);
 assert.match(java,/document\.getElementById\('party-round'\)\.click\(\)/);
 assert.match(ci,/stage unified-party-first/);
 assert.match(ci,/stage unified-party-second/);
 assert.match(ci,/tests\/party-rhino\.js/);
});
