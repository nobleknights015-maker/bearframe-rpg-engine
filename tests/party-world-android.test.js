const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const java=fs.readFileSync(path.join(root,'android/test/RouteRunner.java'),'utf8');
const ci=fs.readFileSync(path.join(root,'.github/workflows/engine-ci.yml'),'utf8');
test('installed Android v2 world inventory, combat, and restart use the same journal',()=>{
 assert.match(java,/checkUnifiedPartyWorldBridge\(boolean restart\)/);
 assert.match(java,/createBearframeSession\(FRAMEWORK_PARTY_FIXTURE/);
 assert.match(java,/worldbridge/);
 assert.match(java,/item:'blade'/);
 assert.match(java,/skill:'pulse'/);
 assert.match(java,/s\.verifySave\(\)/);
 assert.match(ci,/stage unified-v2-world-first/);
 assert.match(ci,/stage unified-v2-world-second/);
 assert.match(ci,/am force-stop dev\.bearframe\.ridge/);
});
