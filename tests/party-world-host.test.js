const test=require('node:test'),assert=require('node:assert/strict');
const make=require('../enginehost/party-world-host');
const project=require('../fixtures/party-world-project');
const clone=x=>JSON.parse(JSON.stringify(x));
function disk(){
 const data=Object.create(null);let failure=false;
 return {read:k=>Object.prototype.hasOwnProperty.call(data,k)?data[k]:null,
  write:(k,v)=>{if(failure)return false;data[k]=v;return true;},
  fail:v=>{failure=v;}};
}
test('v2 world uses one canonical durable session for gear, battle and level-up',()=>{
 const store=disk(),p=clone(project);let w=make(store,p);
 assert.equal(w.snapshot().engineVersion,2);
 assert.equal(w.view().partyProgression.pilot.level,1);
 assert.equal(w.navigate('northeast').reason,'invalid-direction');
 assert.equal(w.navigate('right').ok,true);
 assert.equal(w.view().prompt.event,'supply');
 assert.equal(w.dispatch({type:'choose',id:'collect'}).ok,true);
 for(const item of ['blade','vest','charm'])
   assert.equal(w.dispatch({type:'equip',item:item}).ok,true);
 assert.deepEqual(w.view().partyGear.pilot,
   {weapon:'blade',armor:'vest',accessory:'charm'});
 assert.equal(w.navigate('right').ok,true);
 assert.equal(w.navigate('right').ok,true);
 assert.equal(w.view().partyBattle.foe,'crawler');
 let turns=0;
 while(w.battle()){
  assert.equal(w.submit([{actor:'pilot',skill:'strike',target:'crawler'}]).ok,true);
  assert.ok(++turns<10);
 }
 assert.equal(w.view().partyProgression.pilot.level,2);
 assert.ok(w.view().partyActors[0].skills.includes('focus'));
 assert.equal(w.view().partyGear.pilot.armor,'vest');
 const original=w.view(),saved=w.verifySave();
 assert.equal(saved.ok,true);
 w=make(store,clone(project));
 assert.deepEqual(w.view(),original);
 assert.equal(w.verifySave().ok,true);
 assert.equal(w.view().partyProgression.pilot.xp,10);
});
test('v2 world refuses failed writes without presenting unsaved equipment',()=>{
 const store=disk(),w=make(store,clone(project));
 assert.equal(w.navigate('right').ok,true);
 assert.equal(w.dispatch({type:'choose',id:'collect'}).ok,true);
 const prior=w.view();
 store.fail(true);
 assert.equal(w.dispatch({type:'equip',item:'blade'}).reason,'write-failed');
 assert.deepEqual(w.view(),prior);
 store.fail(false);
 assert.equal(w.dispatch({type:'equip',item:'blade'}).ok,true);
 assert.equal(make(store,clone(project)).view().partyGear.pilot.weapon,'blade');
});
test('v2 world host is isolated from incompatible v1 and party-probe saves',()=>{
 const store=disk();
 const v2=make(store,clone(project));
 const old=require('../framework/session');
 const v1=require('../fixtures/engine-project');
 const v1Session=old(clone(v1),store,null,{slotPrefix:'bf:framework-test:v1:diagnostics'});
 assert.equal(v1Session.start('Separate v1',13).ok,true);
 assert.equal(v2.verifySave().ok,true);
 assert.equal(v1Session.verifySave().ok,true);
 assert.equal(make(store,clone(project)).view().sequence,0);
});
test('offline Android DOM exposes an independent full-world v2 integration UI',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
 const html=read('enginehost/index.html'),boot=read('enginehost/boot.js');
 assert.match(html,/party-world-project\.js/);
 assert.match(html,/party-world-host\.js/);
 assert.match(html,/data-party-world-dir="right"/);
 assert.match(html,/id="party-world-verify"/);
 assert.match(html,/id="party-world-surface"/);
 assert.match(boot,/drawBearframeSceneCanvas\(partyWorldSurface,frame,/);
 assert.match(boot,/partyWorld\.compose\(/);
 assert.match(boot,/renderPartyWorld\(\)/);
 assert.match(boot,/createBearframePartyWorldHost\(storage,partyWorldProject,theme,/);
 assert.match(boot,/:FRAMEWORK_PARTY_WORLD_FIXTURE;/);
 assert.match(boot,/createBearframeRuntimePanels\(/);
 assert.match(boot,/createBearframePartyCommandPanel\(/);
 assert.match(boot,/partyWorld\.verifySave\(\)/);
});
