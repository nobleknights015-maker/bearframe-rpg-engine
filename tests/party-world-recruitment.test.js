const test=require('node:test'),assert=require('node:assert/strict');
const make=require('../enginehost/party-world-host');
const project=require('../fixtures/party-world-project');
const clone=v=>JSON.parse(JSON.stringify(v));
function store(){const disk=Object.create(null);return {
 read:k=>Object.prototype.hasOwnProperty.call(disk,k)?disk[k]:null,
 write:(k,v)=>{disk[k]=v;return true;}
};}
const walk=(world,steps)=>steps.forEach(direction=>{
 assert.equal(world.navigate(direction).ok,true,'move '+direction);
});
test('single v2 journal preserves recruited actor and physical weapon transfer after battle',()=>{
 const storage=store();let w=make(storage,clone(project));
 assert.equal(w.navigate('right').ok,true);
 assert.equal(w.dispatch({type:'choose',id:'collect'}).ok,true);
 walk(w,['right','right']);
 assert.ok(w.battle());
 for(let i=0;w.battle()&&i<10;i++)
  assert.equal(w.submit([{actor:'pilot',skill:'strike',target:'crawler'}]).ok,true);
 assert.equal(w.battle(),null);
 assert.equal(w.view().partyProgression.pilot.level,2);
 // The battle starts on hub tile 3,1. Three further rights reach the
 // scout prompt; a fourth move would be correctly blocked by that prompt.
 walk(w,['right','right','right']);
 assert.equal(w.view().map,'field');
 assert.equal(w.view().prompt.event,'scout');
 assert.equal(w.dispatch({type:'choose',id:'recruit'}).ok,true);
 assert.equal(w.view().partyActors.length,2);
 assert.equal(w.view().partyProgression.scout.level,1);
 assert.equal(w.view().quests.survey,2);
 assert.equal(w.dispatch({type:'equip',actor:'scout',item:'blade'}).ok,true);
 assert.equal(w.view().partyActors[1].attack,10);
 assert.equal(w.dispatch({type:'equip',actor:'pilot',item:'blade'}).reason,'no-change');
 assert.equal(w.verifySave().ok,true);
 const state=w.view();
 w=make(storage,clone(project));
 assert.deepEqual(w.view(),state);
 assert.equal(w.dispatch({type:'unequip',actor:'scout',slot:'weapon'}).ok,true);
 assert.equal(w.dispatch({type:'equip',actor:'pilot',item:'blade'}).ok,true);
 assert.equal(w.view().partyGear.scout.weapon,null);
 assert.equal(w.view().partyGear.pilot.weapon,'blade');
 assert.equal(w.view().inventory.blade,1);
 assert.equal(w.verifySave().ok,true);
});
test('installed Android has a real party-recruitment two-process acceptance route',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const java=read('android/test/RouteRunner.java'),ci=read('.github/workflows/engine-ci.yml');
 for(const item of ['checkUnifiedPartyWorldRecruitment(boolean restart)',
  'data-event-choice=recruit','Test scout','World integration test',
  'unified-party-world-recruit-first','unified-party-world-recruit-second'])
  assert.ok(java.includes(item),'Missing recruitment acceptance evidence: '+item);
 assert.match(ci,/stage unified-party-world-recruit-first/);
 assert.match(ci,/stage unified-party-world-recruit-second/);
});
