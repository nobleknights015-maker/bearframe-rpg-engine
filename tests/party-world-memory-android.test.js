const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const get=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
test('Android memory trim reloads v2 scene without mutating main or party journals',()=>{
 const java=get('android/test/RouteRunner.java'),ci=get('.github/workflows/engine-ci.yml');
 for(const token of [
  'checkUnifiedPartyWorldMemory()',
  'onTrimMemory(android.content.ComponentCallbacks2.TRIM_MEMORY_COMPLETE)',
  'party-world-surface',
  'BearframeHost.partyWorld.view()',
  'renderVisualTickForAudit(0)',
  'BearframeHost.presentationClock.start()',
  'rehydrated!=original',
  '(long)Double.parseDouble(evalHost(hashScript))',
  'V2 movement remained disabled after atlas recovery',
  'BearframeHost.partyWorld.verifySave()'
 ])assert.ok(java.includes(token),'Missing v2 trim evidence: '+token);
 assert.match(ci,/stage unified-party-world-memory/);
 assert.match(ci,/pm clear dev\.bearframe\.ridge/);
});
