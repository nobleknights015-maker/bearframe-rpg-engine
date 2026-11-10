const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('Android migration CI exercises file export/import byte roundtrip after archived source drift',()=>{
 const runner=fs.readFileSync(path.join(__dirname,'../android/test/RouteRunner.java'),'utf8');
 const ci=fs.readFileSync(path.join(__dirname,'../.github/workflows/engine-ci.yml'),'utf8');
 assert.match(runner,/checkUnifiedArchiveFileRoundtrip\(\)/);
 assert.match(runner,/BearframeLegacyVault\.exactCopy\(\)\.raw/);
 assert.match(runner,/java\.nio\.file\.Files\.readAllBytes/);
 assert.match(runner,/raw\.equals\(bytes\)/);
 assert.match(runner,/raw\.equals\(old\.getString\("expedition",null\)\)/);
 assert.match(runner,/fileRoundtrip/);
 assert.match(ci,/stage unified-archive-file/);
 assert.match(ci,/route=PASS unified-archive-file/);
 assert.match(ci,/adb shell am force-stop dev\.bearframe\.ridge/);
});
