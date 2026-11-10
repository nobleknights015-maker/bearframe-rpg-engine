const test=require('node:test'),assert=require('node:assert/strict');
const engine=require('../framework/runtime')(require('../fixtures/engine-project'));
const project=require('../fixtures/engine-project');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('inventory, equipment and quests are copied read-only into canonical view',()=>{
  let s=engine.fresh('Actor',113);
  s=engine.step(s,{type:'move',dir:'right'});
  s=engine.step(s,{type:'choose',id:'collect'});
  const before=engine.serialize(s);
  const v=engine.view(s);
  assert.deepEqual(v.inventory,{blade:1,patch:2});
  assert.deepEqual(v.equipment,{weapon:null});
  assert.deepEqual(v.quests,{survey:0});
  v.inventory.blade=999;v.quests.survey=99;v.equipment.weapon='unknown';
  assert.equal(engine.serialize(s),before,'display-only view mutated simulation');
  const next=engine.step(s,{type:'equip',item:'blade'});
  assert.equal(engine.view(next).weapon,'blade');
  assert.deepEqual(engine.view(next).equipment,{weapon:'blade'});
  assert.equal(next.sequence,s.sequence+1);
  assert.equal(engine.restore(engine.serialize(next)).equipment.weapon,'blade');
});
test('host event and equipment selectors call only saved-session commands',()=>{
 const ui=read('enginehost/runtime-panels.js');
 const html=read('enginehost/index.html'),boot=read('enginehost/boot.js');
 assert.match(html,/id="runtime-event-controls"/);
 assert.match(html,/id="runtime-inventory-controls"/);
 assert.match(html,/runtime-panels\.js/);
 assert.match(ui,/data-event-choice/);
 assert.match(ui,/data-inventory-equip/);
 assert.match(ui,/data-inventory-use/);
 assert.match(ui,/data-inventory-unequip/);
 assert.match(ui,/outcome=dispatch\(command\)/);
 assert.match(ui,/locked=!!v\.prompt\|\|!!v\.battle\|\|!!v\.partyBattle/);
 assert.match(boot,/createBearframeRuntimePanels/);
 assert.match(boot,/runtimePanels\.render\(\)/);
 assert.match(boot,/inventory:v\?v\.inventory:null/);
});

test('installed Android engine uses actual UI event/gear buttons and same journal after restart',()=>{
 const java=read('android/test/RouteRunner.java'),ci=read('.github/workflows/engine-ci.yml');
 assert.match(java,/checkUnifiedRuntimePanels\(boolean restart\)/);
 assert.match(java,/data-event-choice=collect/);
 assert.match(java,/data-inventory-equip=blade/);
 assert.match(java,/data-inventory-unequip/);
 assert.match(java,/Choice effects were not durably committed/);
 assert.match(java,/Inventory\/equipment\/quest progress lost/);
 assert.match(ci,/stage unified-inventory-first/);
 assert.match(ci,/stage unified-inventory-second/);
});

test('mobile world flow visibly distinguishes pending events, combat, and verified save',()=>{
 const host=read('enginehost/boot.js'),html=read('enginehost/index.html');
 const battle=read('enginehost/runtime-combat-panel.js');
 assert.ok(html.indexOf('runtime-event-controls')<html.indexOf('class="pad"'));
 assert.ok(html.indexOf('runtime-combat-controls')<html.indexOf('class="pad"'));
 assert.ok(html.indexOf('runtime-save-status')<html.indexOf('runtime-inventory-controls'));
 assert.match(host,/directional\.forEach\(function\(button\)\{button\.disabled=blocked;/);
 assert.match(host,/A conversation needs your choice/);
 assert.match(host,/An encounter has begun/);
 assert.match(host,/No movement: a wall/);
 assert.match(host,/engine\.verifySave\(\)/);
 assert.match(host,/saveStatus\.textContent=/);
 assert.match(html,/id="runtime-save-verify"/);
 for(const x of ['strike','pulse','guard','flee'])
   assert.match(battle,new RegExp("'"+x+"'"));
 assert.match(battle,/dispatch\(\{type:'combat',id:option\[0\]\}\)/);
});
