const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const get=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('native Android screen switch and event focus gate is installed and saved across process death',()=>{
 const java=get('android/test/RouteRunner.java');
 const ci=get('.github/workflows/engine-ci.yml');
 for(const token of [
  'checkUnifiedPartyWorldScreens(boolean restart)',
  'BearframeHost.partyWorldScreens',
  "getAttribute('aria-selected')",
  "new KeyboardEvent('keydown'",
  "getClientRects().length",
  "hasAttribute('data-event-choice')",
  "party-world-verify",
  "h.verifySave()",
  "unified-party-screens-first",
  "unified-party-screens-second"
 ])assert.ok(java.includes(token),'Missing installed v2 UI evidence '+token);
 assert.match(ci,/stage unified-party-screens-first/);
 assert.match(ci,/stage unified-party-screens-second/);
 assert.match(ci,/am force-stop dev\.bearframe\.ridge/);
});
