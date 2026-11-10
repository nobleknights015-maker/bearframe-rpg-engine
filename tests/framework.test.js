const test=require('node:test');
const assert=require('node:assert/strict');
const validate=require('../framework/schema');
const create=require('../framework/runtime');
const original=require('../fixtures/engine-project');
const clone=v=>JSON.parse(JSON.stringify(v));
const changed=fn=>{const p=clone(original);fn(p);return p;};
const make=()=>create(original);
const act=(engine,state,type,rest)=>engine.step(state,{type,...rest});
const supply=(engine,s)=>{
  const prompt=act(engine,s,'move',{dir:'right'});
  assert.equal(prompt.prompt.event,'supply');
  return act(engine,prompt,'choose',{id:'collect'});
};
const encounter=(engine,s)=>{
  let x=supply(engine,s);x=act(engine,x,'move',{dir:'right'});
  return act(engine,x,'move',{dir:'right'});
};
test('accepts a complete project and rejects malformed geometry, cross-references and effects',()=>{
  assert.equal(validate(original),original);
  assert.throws(()=>validate(changed(p=>p.maps.hub.rows[1]+='.')),/matching width/);
  assert.throws(()=>validate(changed(p=>p.maps.hub.exits['5,1'].map='absent')),/missing destination map/);
  assert.throws(()=>validate(changed(p=>p.maps.hub.events['2,1']='absent')),/unknown event/);
  assert.throws(()=>validate(changed(p=>p.events.supply.choices[0].effects[0].item='absent')),/unknown item/);
  assert.throws(()=>validate(changed(p=>p.events.supply.choices[0].effects[0].qty=0)),/must be integer/);
  assert.throws(()=>validate(changed(p=>p.quests.survey.stages=[])),/requires stages/);
  assert.throws(()=>validate(changed(p=>p.foes.crawler.attack=-1)),/must be integer/);
  assert.throws(()=>validate(changed(p=>p.events.supply.choices.push({...p.events.supply.choices[0]}))),/duplicate choice/);
  assert.throws(()=>validate(changed(p=>p.start.x=0)),/destination is blocked/);
});
test('creates a valid independent starting state with an exact schema version',()=>{
  const engine=make(),s=engine.fresh('  Test Pilot  ',123);
  assert.equal(s.player.name,'Test Pilot');assert.equal(s.project,'framework-test');
  assert.equal(s.rng,123);assert.equal(s.version,1);assert.equal(s.sequence,0);
  assert.equal(s.player.hp,30);assert.equal(s.player.charge,3);
  assert.ok(engine.validateState(s));
  assert.equal(engine.fresh('   ').player.name,'Frame');
  assert.equal(engine.fresh('x'.repeat(100)).player.name.length,24);
});
test('invalid commands, walls, and unsupported gear leave state reference unchanged',()=>{
  const e=make(),s=e.fresh('Pilot');
  assert.equal(act(e,s,'move',{dir:'up'}),s);
  assert.equal(act(e,s,'move',{dir:'diagonal'}),s);
  assert.equal(act(e,s,'combat',{id:'pulse'}),s);
  assert.equal(act(e,s,'equip',{item:'blade'}),s);
  assert.equal(act(e,s,'use',{item:'patch'}),s);
  assert.equal(e.step(s,null),s);
  assert.equal(e.step(s,{type:'unknown'}),s);
});
test('one-shot event gives equipment, quest and items transactionally, then becomes walkable',()=>{
  const e=make(),s=e.fresh('Pilot');
  const p=act(e,s,'move',{dir:'right'});
  assert.equal(p.player.x,1);assert.equal(p.prompt.event,'supply');
  assert.equal(act(e,p,'move',{dir:'right'}),p);
  assert.equal(act(e,p,'choose',{id:'missing'}),p);
  const done=act(e,p,'choose',{id:'collect'});
  assert.equal(done.flags['event:hub:2,1'],true);
  assert.deepEqual(done.inventory,{blade:1,patch:2});
  assert.equal(done.quests.survey,0);
  assert.equal(done.message,'Supplies recovered.');
  assert.equal(s.inventory.blade,undefined);
  assert.equal(done.sequence,p.sequence+1);
  const through=act(e,done,'move',{dir:'right'});
  assert.equal(through.player.x,2);
  assert.equal(through.prompt,null);
});
test('item transfers are atomic; equipment, healing, quests and repeated events work',()=>{
  const e=make(),s=supply(e,e.fresh('Pilot'));
  const equipped=act(e,s,'equip',{item:'blade'});
  assert.equal(equipped.equipment.weapon,'blade');
  assert.equal(equipped.inventory.blade,1);
  assert.equal(act(e,equipped,'equip',{item:'blade'}),equipped);
  const move2=act(e,equipped,'move',{dir:'down'}); // from x=1,y=1 to x=1,y=2
  const prompt=act(e,move2,'move',{dir:'right'}); // mechanic at (2,2)
  assert.equal(prompt.prompt.event,'mechanic');
  const refused=act(e,prompt,'choose',{id:'restock'});
  assert.equal(refused,prompt);
  assert.equal(prompt.inventory.patch,2);
  const trade=act(e,prompt,'choose',{id:'trade'});
  assert.equal(trade.inventory.patch,1);
  assert.equal(trade.quests.survey,1);
  const reoffer=act(e,trade,'move',{dir:'right'});
  assert.equal(reoffer.prompt.event,'mechanic');
  const dismissed=act(e,reoffer,'close');
  assert.equal(dismissed.prompt,null);
  assert.equal(act(e,equipped,'use',{item:'patch'}),equipped); // full HP
  const unequipped=act(e,trade,'unequip');
  assert.equal(unequipped.equipment.weapon,null);
});
test('player-versus-foe combat is deterministic, survives reload and awards experience',()=>{
  const e=make(),initial=encounter(e,e.fresh('Pilot',43));
  assert.equal(initial.battle.foe,'crawler');
  assert.equal(initial.battle.turn,1);
  const stored=e.serialize(initial);
  const restored=e.restore(stored);assert.deepEqual(restored,initial);
  const first=act(e,initial,'combat',{id:'pulse'});
  const copy=act(e,restored,'combat',{id:'pulse'});
  assert.deepEqual(first,copy);
  assert.equal(first.player.charge,2);
  assert.equal(first.battle.turn,2);
  const invalid=act(e,first,'combat',{id:'impossible'});assert.equal(invalid,first);
  let current=first;
  for(let i=0;i<10&&current.battle;i++)current=act(e,current,'combat',{id:'strike'});
  assert.equal(current.battle,null);
  assert.equal(current.player.xp,10);
  assert.equal(current.flags['encounter:hub:3,1'],true);
  assert.equal(e.restore(e.serialize(current)).player.xp,10);
});
test('guard and flee are legal; battle turns reject map interactions',()=>{
  const e=make(),s=encounter(e,e.fresh('Pilot',11));
  assert.equal(act(e,s,'move',{dir:'left'}),s);
  const guarded=act(e,s,'combat',{id:'guard'});
  assert.equal(guarded.battle.turn,2);
  assert.ok(guarded.player.hp>=s.player.hp-5);
  assert.equal(guarded.player.charge,3);
  const fled=act(e,s,'combat',{id:'flee'});
  assert.equal(fled.battle,null);
  assert.match(fled.message,/disengage/);
});
test('map transitions and recruits use event scripts rather than hardcoded locations',()=>{
  const e=make();let s=supply(e,e.fresh('Pilot'));
  s=act(e,s,'move',{dir:'right'});
  let encounter=act(e,s,'move',{dir:'right'});
  while(encounter.battle)encounter=act(e,encounter,'combat',{id:'strike'});
  encounter=act(e,encounter,'move',{dir:'right'});
  encounter=act(e,encounter,'move',{dir:'right'});
  assert.equal(encounter.player.map,'field');
  assert.deepEqual([encounter.player.x,encounter.player.y],[1,1]);
  const prompt=act(e,encounter,'move',{dir:'right'});
  const recruited=act(e,prompt,'choose',{id:'recruit'});
  assert.deepEqual(recruited.allies,['scout']);
  assert.equal(recruited.quests.survey,2);
  assert.equal(recruited.flags.met_scout,true);
  assert.equal(e.view(recruited).mapName,'Engine field');
  assert.notEqual(e.view(recruited).rows,original.maps.field.rows);
});
test('bad save files never enter runtime; old schema and mismatched game IDs fail closed',()=>{
  const e=make(),base=e.fresh('Pilot');
  for(const raw of ['','null','{','{}',JSON.stringify({...base,version:2}),JSON.stringify({...base,project:'other'}),
    JSON.stringify({...base,player:{...base.player,hp:0}}),JSON.stringify({...base,player:{...base.player,x:0}}),
    JSON.stringify({...base,inventory:{missing:1}}),JSON.stringify({...base,quests:{unknown:0}}),
    JSON.stringify({...base,rng:0}),JSON.stringify({...base,prompt:{event:'missing',origin:'hub:2,1'}})
  ])assert.equal(e.restore(raw),null,'expected reject '+String(raw).slice(0,60));
  assert.deepEqual(e.restore(e.serialize(base)),base);
  assert.throws(()=>e.serialize({...base,version:2}),/Invalid state/);
});
test('hundreds of seeded commands remain restorable and never mutate input state',()=>{
  const e=make();const commands=[
    {type:'move',dir:'up'},{type:'move',dir:'down'},{type:'move',dir:'right'},
    {type:'move',dir:'left'},{type:'choose',id:'collect'},{type:'choose',id:'leave'},
    {type:'choose',id:'trade'},{type:'choose',id:'recruit'},{type:'close'},
    {type:'combat',id:'pulse'},{type:'combat',id:'strike'},{type:'combat',id:'guard'},
    {type:'combat',id:'flee'},{type:'equip',item:'blade'},{type:'use',item:'patch'},{type:'interact'}
  ];
  for(let seed=1;seed<=12;seed++){
    let s=e.fresh('Fuzzer',seed),rand=seed;
    for(let n=0;n<200;n++){
      rand^=rand<<13;rand^=rand>>>17;rand^=rand<<5;
      const cmd=commands[(rand>>>0)%commands.length];
      const before=e.serialize(s);
      const next=e.step(s,cmd);
      assert.equal(e.serialize(s),before,'input state mutated');
      assert.ok(e.validateState(next),'invalid state '+seed+':'+n);
      assert.deepEqual(e.restore(e.serialize(next)),next,'save round trip '+seed+':'+n);
      s=next;
    }
  }
});
