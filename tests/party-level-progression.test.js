const test=require('node:test'),assert=require('node:assert/strict');
const make=require('../framework/runtime'),progressFactory=require('../framework/progression');
const makeSession=require('../framework/session');
const basic=require('../fixtures/party-engine-project');
const clone=x=>JSON.parse(JSON.stringify(x));
function definition(){
 const p=clone(basic);
 p.contentRevision='progression_1';
 p.partyCombat.skills.focus={kind:'damage',power:16,cost:1,element:'physical'};
 p.partyCombat.progression={
  thresholds:[0,10,30],
  growth:{
   pilot:{hp:4,mp:1,attack:2,defense:1,speed:0},
   scout:{hp:3,mp:1,attack:1,defense:1,speed:1}
  },
  unlocks:{pilot:{2:['focus']},scout:{2:['pulse']}}
 };
 p.events.supply.choices[0].effects.push({type:'recruit',ally:'scout'});
 return p;
}
const cmds=[
 {type:'move',dir:'right'},{type:'choose',id:'collect'},
 {type:'move',dir:'right'},{type:'move',dir:'right'}
];
const orders=[
 {actor:'pilot',skill:'strike',target:'crawler'},
 {actor:'scout',skill:'strike',target:'crawler'}
];
test('opt-in progression validates curves, growth and skill unlock references',()=>{
 const p=definition(),e=make(p);
 assert.match(e.contentTag,/^v1:progression_1:/);
 assert.equal(e.version,2);
 for(const mutate of [
  p=>p.partyCombat.progression.thresholds[0]=1,
  p=>p.partyCombat.progression.thresholds[2]=8,
  p=>p.partyCombat.progression.growth.scout.hp=-1,
  p=>delete p.partyCombat.progression.growth.scout,
  p=>p.partyCombat.progression.unlocks.scout[2]=['missing'],
  p=>p.partyCombat.progression.unlocks.pilot[2]=['strike'],
  p=>p.partyCombat.progression.unlocks.pilot[3]=['focus'],
  p=>delete p.contentRevision
 ]){
  const invalid=definition();mutate(invalid);
  assert.throws(()=>make(invalid),/progression|threshold|growth|skill|contentRevision|unlock/i);
 }
});
test('level 2 earns stat growth, skill unlocks, ally XP, and persists original gear',()=>{
 const e=make(definition());let s=e.fresh('Leveler',23);
 assert.equal(e.view(s).partyProgression.pilot.level,1);
 for(const c of cmds)s=e.step(s,c);
 assert.equal(s.allies[0],'scout');
 assert.equal(s.allyStats.scout.xp,0);
 assert.equal(s.partyBattle.foe,'crawler');
 let n=0;
 while(s.partyBattle){
  s=e.step(s,{type:'party-round',orders});
  assert.ok(++n<10);
 }
 assert.equal(s.player.xp,10);
 assert.equal(s.allyStats.scout.xp,10);
 assert.equal(s.player.maxHp,34);
 assert.equal(s.player.maxCharge,4);
 const view=e.view(s);
 assert.equal(view.partyProgression.pilot.level,2);
 assert.equal(view.partyProgression.scout.level,2);
 assert.equal(view.partyProgression.pilot.nextLevelXp,30);
 assert.equal(view.partyActors[0].maxHp,34);
 assert.equal(view.partyActors[0].attack,12);
 assert.ok(view.partyActors[0].skills.includes('focus'));
 assert.equal(view.partyActors[1].maxHp,27);
 assert.equal(view.partyActors[1].speed,6);
 assert.ok(view.partyActors[1].skills.includes('pulse'));
 assert.equal(e.validateState(s),true);
 assert.deepEqual(e.restore(e.serialize(s)),s);
});
test('progression levels remain deterministic at max and saturate stats safely',()=>{
 const p=definition(),engine=make(p),s=engine.fresh('Maxed',13);
 s.player.xp=2147483647;
 s.player.maxHp=38;s.player.maxCharge=5;
 s.player.hp=38;s.player.charge=5;
 assert.equal(engine.validateState(s),true);
 const view=engine.view(s);
 assert.equal(view.partyProgression.pilot.level,3);
 assert.equal(view.partyProgression.pilot.nextLevelXp,null);
 assert.equal(view.partyActors[0].attack,14);
 assert.deepEqual(engine.restore(engine.serialize(s)),s);
});
test('progression leaves older v2 projects, journals and state fields unchanged',()=>{
 const e=make(clone(basic));let s=e.fresh('Legacy',27);
 s.allies.push('scout');s.allyStats.scout={hp:24,mp:2};
 assert.equal(e.validateState(s),true);
 assert.equal('partyProgression' in e.view(s),false);
 assert.deepEqual(s.allyStats.scout,{hp:24,mp:2});
 assert.equal(e.view(s).partyActors[0].level,undefined);
});
test('level-up save is atomic and remains available after session restart',()=>{
 const p=definition(),storageData=Object.create(null);
 const storage={read:k=>Object.prototype.hasOwnProperty.call(storageData,k)?storageData[k]:null,
  write:(k,v)=>{storageData[k]=v;return true;}};
 const opts={slotPrefix:'bf:party-progress:v2:check'};
 let s=makeSession(p,storage,null,opts);
 assert.equal(s.start('Leveler',31).ok,true);
 for(const c of cmds)assert.equal(s.dispatch(c).ok,true);
 let rounds=0;
 while(s.snapshot().view.partyBattle){
  assert.equal(s.dispatch({type:'party-round',orders}).ok,true);
  assert.ok(++rounds<10);
 }
 const state=s.serialize(),before=s.snapshot().view;
 assert.equal(before.partyProgression.scout.level,2);
 s=makeSession(p,storage,null,opts);
 assert.equal(s.resume().ok,true);
 assert.equal(s.serialize(),state);
 assert.equal(s.snapshot().view.partyProgression.pilot.level,2);
 assert.equal(s.verifySave().ok,true);
});
test('no accidental compatibility claim for untagged old v2 saves',()=>{
 const p=definition();
 const e=make(p),legacy=make(clone(basic)),storeData=Object.create(null);
 const store={read:k=>storeData[k]||null,write:(k,v)=>{storeData[k]=v;return true;}};
 const slots=require('../framework/save-slots');
 assert.equal(slots(legacy,store).save(legacy.fresh('Older',31)).ok,true);
 assert.equal(slots(e,store).health().contentMismatch,true);
 assert.equal(slots(e,store).load(),null);
 assert.equal(slots(e,store).save(e.fresh('New',31)).reason,'content-mismatch');
});
test('browser and Rhino package progression module before party runtime',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const html=read('enginehost/index.html'),ci=read('.github/workflows/engine-ci.yml');
 assert.ok(html.indexOf('framework/progression.js')<html.indexOf('framework/party-runtime.js'));
 assert.match(ci,/-f framework\/progression\.js -f framework\/party-runtime\.js/);
 assert.match(read('enginehost/runtime-panels.js'),/v\.partyProgression/);
});
