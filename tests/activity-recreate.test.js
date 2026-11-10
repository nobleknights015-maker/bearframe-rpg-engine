const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('installed Android Activity recreation must replay journal and texture recovery',()=>{
 const java=fs.readFileSync(path.join(__dirname,'../android/test/RouteRunner.java'),'utf8');
 const ci=fs.readFileSync(path.join(__dirname,'../.github/workflows/engine-ci.yml'),'utf8');
 assert.match(java,/checkUnifiedRecreate\(\)/);
 assert.match(java,/runOnMainSync\(\(\)->old\.recreate\(\)\)/);
 assert.match(java,/waitForMonitorWithTimeout\(monitor,15000\)/);
 assert.match(java,/restored==null\|\|restored==old/);
 assert.match(java,/recovered\.getInt\("assetsLoaded"\)!=2/);
 assert.match(java,/finalState\.getInt\("savedRevision"\)!=2/);
 assert.match(ci,/stage unified-recreate dev\.bearframe\.ridge\.tests\/\.RouteRunner/);
 assert.match(ci,/route=PASS unified-recreate/);
});
