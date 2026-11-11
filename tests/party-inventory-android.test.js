const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const get=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('Android installed inventory buttons exercise party equipment and native save restart',()=>{
 const java=get('android/test/RouteRunner.java'),ci=get('.github/workflows/engine-ci.yml');
 assert.match(java,/checkUnifiedPartyInventoryUi\(boolean restart\)/);
 assert.match(java,/createBearframeRuntimePanels\(ev,gear,status,p/);
 assert.match(java,/data-inventory-equip/);
 assert.match(java,/data-inventory-use/);
 assert.match(java,/data-inventory-unequip/);
 assert.match(java,/s\.verifySave\(\)/);
 assert.match(java,/duplicate weapon available/);
 assert.match(java,/gear\\.querySelectorAll/);
 assert.match(java,/return JSON\\.stringify\\(\\{error:String\\(error\\)/);
 // Native UI test must quote slot IDs containing punctuation.
 assert.ok(java.includes("'+value+'\\\\\"]"),'inventory CSS selector must quote values');

 assert.match(ci,/stage unified-gear-ui-first/);
 assert.match(ci,/stage unified-gear-ui-second/);
 assert.match(ci,/am force-stop dev\.bearframe\.ridge/);
});
