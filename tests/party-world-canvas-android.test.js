const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const get=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
test('installed WebView canvas changes actual pixels as durable v2 world position changes',()=>{
 const java=get('android/test/RouteRunner.java');
 const workflow=get('.github/workflows/engine-ci.yml');
 const html=get('enginehost/index.html');
 for(const token of [
   'checkUnifiedPartyWorldCanvas(boolean restart)',
   "getElementById('party-world-surface')",
   "getImageData(0,0,c.width,c.height)",
   "w.compose({width:c.width,height:c.height",
   "button.click()",
   'proof.getLong("start")==proof.getLong("end")',
   'w.verifySave()'
 ])assert.ok(java.includes(token),'Missing installed scene acceptance: '+token);
 assert.match(workflow,/stage unified-party-world-canvas-first/);
 assert.match(workflow,/stage unified-party-world-canvas-second/);
 assert.match(workflow,/am force-stop dev\.bearframe\.ridge/);
 assert.match(html,/id="party-world-surface"/);
});
