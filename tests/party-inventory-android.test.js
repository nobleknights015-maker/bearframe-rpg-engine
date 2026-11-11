const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const get=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('Android installed inventory buttons exercise party equipment and native save restart',()=>{
 const java=get('android/test/RouteRunner.java'),ci=get('.github/workflows/engine-ci.yml');
 for(const token of [
  'checkUnifiedPartyInventoryUi(boolean restart)',
  'createBearframeRuntimePanels(ev,gear,status,p',
  'data-inventory-equip','data-inventory-use','data-inventory-unequip',
  's.verifySave()','duplicate weapon available','gear.querySelectorAll',
  "var all=gear.querySelectorAll(","'+value+'",'catch(error)'
 ])assert.ok(java.includes(token),'Missing Android gear selector evidence: '+token);
 assert.match(ci,/stage unified-gear-ui-first/);
 assert.match(ci,/stage unified-gear-ui-second/);
 assert.match(ci,/am force-stop dev\.bearframe\.ridge/);
});
