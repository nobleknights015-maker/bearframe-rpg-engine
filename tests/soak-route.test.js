const test=require('node:test'),assert=require('node:assert/strict');
const session=require('../framework/session');
const project=require('../fixtures/engine-project');
const fs=require('node:fs');
test('hundreds of durable movement commits preserve exact revision across process recreation',()=>{
 const disk=Object.create(null);
 const storage={read:k=>disk[k]||null,write:(k,v)=>{disk[k]=v;return true;}};
 const make=()=>session(project,storage,null,{slotPrefix:'bf:framework-test:v1:soak'});
 let first=make();
 assert.equal(first.start('Soak fixture',8735).ok,true);
 for(let i=0;i<128;i++){
  assert.equal(first.dispatch({type:'move',dir:'down'}).ok,true);
  assert.equal(first.dispatch({type:'move',dir:'up'}).ok,true);
 }
 assert.equal(first.snapshot().view.sequence,256);
 assert.equal(first.snapshot().view.y,1);
 let second=make();
 assert.equal(second.resume().ok,true);
 assert.equal(second.snapshot().view.sequence,256);
 for(let i=0;i<32;i++){
  assert.equal(second.dispatch({type:'move',dir:'down'}).ok,true);
  assert.equal(second.dispatch({type:'move',dir:'up'}).ok,true);
 }
 assert.equal(second.snapshot().view.sequence,320);
 assert.equal(second.snapshot().journal.validSlots,2);
 let third=make();
 assert.equal(third.resume().ok,true);
 assert.deepEqual(third.snapshot().view,second.snapshot().view);
});
test('installed emulator CI includes both sequential soak stages and force-stop recovery',()=>{
 const java=fs.readFileSync(require('node:path').join(__dirname,'../android/test/RouteRunner.java'),'utf8');
 const ci=fs.readFileSync(require('node:path').join(__dirname,'../.github/workflows/engine-ci.yml'),'utf8');
 assert.match(java,/checkUnifiedSoak\(boolean restart\)/);
 assert.match(java,/restart\?256:0,cycles=restart\?32:128/);
 assert.match(java,/stage\.equals\("unified-soak-first"\)/);
 assert.match(java,/stage\.equals\("unified-soak-second"\)/);
 assert.match(ci,/stage unified-soak-first/);
 assert.match(ci,/stage unified-soak-second/);
 assert.match(ci,/adb shell am force-stop dev\.bearframe\.ridge\s+adb shell am instrument -w -e stage unified-soak-second/);
});
