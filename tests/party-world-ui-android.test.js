const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const get=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('installed WebView must drive visible v2 party world controls then reload native journal',()=>{
 const java=get('android/test/RouteRunner.java');
 const ci=get('.github/workflows/engine-ci.yml');
 for(const evidence of [
  'checkUnifiedPartyWorldUi(boolean restart)',
  'BearframeHost.partyWorld',
  'party-world-events',
  'data-party-world-dir',
  'data-inventory-equip',
  '#party-world-battle #party-commit',
  'h.verifySave()',
  'contains("Level 2")',
  'unified-party-world-ui-first',
  'unified-party-world-ui-second'
 ])assert.ok(java.includes(evidence),'Missing Android UI regression: '+evidence);
 assert.match(ci,/stage unified-party-world-ui-first/);
 assert.match(ci,/stage unified-party-world-ui-second/);
 assert.match(ci,/am force-stop dev\.bearframe\.ridge/);
});
