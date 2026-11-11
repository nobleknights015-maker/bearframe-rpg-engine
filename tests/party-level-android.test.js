const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('installed Android WebView verifies opt-in party level/skill progression across restart',()=>{
 const java=read('android/test/RouteRunner.java');
 const ci=read('.github/workflows/engine-ci.yml');
 for(const token of [
  'checkUnifiedProgression(boolean restart)',"p.contentRevision='leveling_1'",
  'p.partyCombat.progression=',"'party-round'","{type:'equip',item:'blade'}",
  'createBearframeRuntimePanels(eventRoot,gear,status,p','Level 2',
  's.verifySave()'
 ])assert.ok(java.includes(token),'Missing '+token);
 assert.match(ci,/stage unified-level-first/);
 assert.match(ci,/stage unified-level-second/);
 assert.match(ci,/am force-stop dev\.bearframe\.ridge/);
});
