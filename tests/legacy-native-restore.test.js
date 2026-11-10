const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('Android document recovery validates historical v1 JSON and refuses to overwrite any existing old save',()=>{
 const validator=fs.readFileSync(path.join(__dirname,'../android/src/dev/bearframe/ridge/LegacyV1Validator.java'),'utf8');
 const restore=fs.readFileSync(path.join(__dirname,'../android/src/dev/bearframe/ridge/LegacyArchiveExport.java'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../enginehost/index.html'),'utf8');
 const boot=fs.readFileSync(path.join(__dirname,'../enginehost/boot.js'),'utf8');
 const runner=fs.readFileSync(path.join(__dirname,'../android/test/RouteRunner.java'),'utf8');
 const ci=fs.readFileSync(path.join(__dirname,'../.github/workflows/engine-ci.yml'),'utf8');
 assert.match(validator,/LegacyV1Validator/);
 assert.match(validator,/rows\[y\]\.charAt\(x\)=='#'/);
 assert.match(validator,/hasOnly\(flags,FLAGS\)/);
 assert.match(validator,/echoAlly/);
 assert.match(restore,/Intent\.ACTION_OPEN_DOCUMENT/);
 assert.match(restore,/CodingErrorAction\.REPORT/);
 assert.match(restore,/if\(old\.contains\("expedition"\)\)return false/);
 assert.match(restore,/old\.edit\(\)\.putString\("expedition",raw\)\.commit\(\)/);
 assert.match(restore,/raw\.equals\(old\.getString\("expedition",null\)\)/);
 assert.match(html,/legacy-restore/);
 assert.match(boot,/archiveExport\.beginRestore\(\)/);
 assert.match(runner,/checkUnifiedRestoreNative\(\)/);
 // Installed Android acceptance must distinguish legitimate '<' exits from walls.
 // Regression: x=0,y=4 in gallery is a valid exit; x=0,y=0 and
 // x=7,y=1 are actual blocked tiles. Never weaken the validator to
 // accommodate a mistaken geometry assertion.
 assert.match(runner,/blockedInterior=new JSONObject\(raw\)\.put\("x",7\)\.put\("y",1\)/);
 assert.match(runner,/blocked=new JSONObject\(raw\)\.put\("x",0\)\.put\("y",0\)/);
 assert.match(runner,/exit=new JSONObject\(raw\)\.put\("x",0\)/);
 assert.match(runner,/!sourceValid\|\|blockedAccepted\|\|interiorAccepted\|\|!exitAccepted/);
 assert.match(runner,/restore\.invoke\(exporter,raw\)/);
 assert.match(runner,/raw\.equals\(old\.getString\("expedition",null\)\)/);
 assert.match(ci,/stage unified-restore-native/);
});
