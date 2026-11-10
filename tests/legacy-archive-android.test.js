const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('Android source archive requires separate consent and survives installed restart',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../enginehost/index.html'),'utf8');
 const boot=fs.readFileSync(path.join(__dirname,'../enginehost/boot.js'),'utf8');
 const runner=fs.readFileSync(path.join(__dirname,'../android/test/RouteRunner.java'),'utf8');
 const ci=fs.readFileSync(path.join(__dirname,'../.github/workflows/engine-ci.yml'),'utf8');
 assert.match(html,/legacy-archive\.js/);
 assert.match(html,/id="legacy-confirm"[^>]*disabled/);
 assert.match(boot,/createBearframeLegacyArchive/);
 assert.match(boot,/vault\.inspect\(\)/);
 assert.match(boot,/vault\.confirm\(\)/);
 assert.match(boot,/window\.BearframeLegacyVault=vault/);
 assert.match(runner,/checkUnifiedArchive\(boolean restart\)/);
 assert.match(runner,/old\.getString\("expedition",null\)/);
 assert.match(runner,/original\.equals\(archived\)/);
 assert.match(runner,/sourceMatches/);
 assert.match(ci,/stage unified-archive-first/);
 assert.match(ci,/stage unified-archive-second/);
 assert.match(ci,/adb shell am force-stop dev\.bearframe\.ridge/);
});
test('legacy decoder geometry matches historical world and rejects a wall snapshot',()=>{
 const legacy=require('../framework/legacy-save-v1'),old=require('../game/engine')(require('../game/world'));
 const s=old.fresh('Migration','Ash');assert.ok(legacy.decode(JSON.stringify(s)));
 s.x=0;s.y=0;
 assert.equal(old.restore(JSON.stringify(s)),null);
 assert.throws(()=>legacy.decode(JSON.stringify(s)),TypeError);
});
