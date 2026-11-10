const test=require('node:test'),assert=require('node:assert/strict');
const make=require('../framework/party-combat');
const skills={
 strike:{kind:'damage',power:5,cost:0,element:'physical'},
 pulse:{kind:'damage',power:11,cost:2,element:'arc',status:{type:'poison',turns:2,potency:3}},
 patch:{kind:'heal',power:8,cost:2,element:'arc'},
 guard:{kind:'guard',power:0,cost:0,element:'physical'}
};
const pilot=()=>({id:'pilot',name:'Pilot',hp:40,maxHp:40,mp:6,maxMp:6,attack:10,defense:4,
 speed:9,skills:['strike','pulse','patch','guard'],resistances:{arc:100}});
const scout=()=>({id:'scout',name:'Scout',hp:25,maxHp:25,mp:0,maxMp:0,attack:6,defense:2,
 speed:5,skills:['strike'],resistances:{}});
const crawler=()=>({id:'crawler',name:'Crawler',hp:70,maxHp:70,mp:0,maxMp:0,attack:6,defense:2,
 speed:3,skills:['strike'],resistances:{arc:100}});
const clone=x=>JSON.parse(JSON.stringify(x));
test('rejects illegal abilities and invalid roster records',()=>{
 assert.throws(()=>make({bad:{kind:'attack',power:1,cost:0,element:'physical'}}),/Invalid skill/);
 assert.throws(()=>make({bad:{kind:'damage',power:1,cost:0,element:'physical',
  status:{type:'bleed',turns:2,potency:2}}}),/Invalid status/);
 const combat=make(skills);
 assert.throws(()=>combat.begin([pilot(),pilot()],[crawler()],11),/Invalid party or enemy roster/);
 assert.throws(()=>combat.begin([pilot()],[{...crawler(),maxHp:0}],11),/Invalid party or enemy roster/);
 assert.throws(()=>combat.begin([pilot()],[{...crawler(),skills:['missing']}],11),/Invalid party or enemy roster/);
});
test('a two-character party executes speed-ordered actions without mutating the input',()=>{
 const combat=make(skills),s=combat.begin([pilot(),scout()],[crawler()],123);
 const serialized=combat.serialize(s);
 const next=combat.round(s,[{actor:'pilot',skill:'pulse',target:'crawler'},
  {actor:'scout',skill:'strike',target:'crawler'}]);
 assert.equal(combat.serialize(s),serialized);
 assert.equal(next.turn,2);
 assert.equal(next.party[0].mp,4);
 assert.ok(next.foes[0].hp<70);
 assert.ok(next.log[0].startsWith('Pilot hits Crawler'));
 assert.ok(next.log.some(x=>x.startsWith('Scout hits Crawler')));
 assert.equal(next.phase,'active');
 assert.deepEqual(combat.restore(combat.serialize(next)),next);
});
test('preflight rejects missing targets, duplicate actions, invalid moves and insufficient mana',()=>{
 const combat=make(skills),s=combat.begin([pilot(),scout()],[crawler()],21);
 for(const actions of [
  [],
  [{actor:'pilot',skill:'pulse',target:'missing'},{actor:'scout',skill:'strike',target:'crawler'}],
  [{actor:'pilot',skill:'patch',target:'crawler'},{actor:'scout',skill:'strike',target:'crawler'}],
  [{actor:'pilot',skill:'strike',target:'crawler'},{actor:'pilot',skill:'strike',target:'crawler'}],
  [{actor:'pilot',skill:'invalid',target:'crawler'},{actor:'scout',skill:'strike',target:'crawler'}]
 ])assert.equal(combat.round(s,actions),s);
 const exhausted=combat.begin([{...pilot(),mp:0}], [crawler()],21);
 assert.equal(combat.round(exhausted,[{actor:'pilot',skill:'pulse',target:'crawler'}]),exhausted);
});
test('guarding before enemy action reduces incoming damage',()=>{
 const combat=make(skills);
 const unguarded=combat.begin([pilot()],[crawler()],99);
 const guard=combat.round(unguarded,[{actor:'pilot',skill:'guard'}]);
 const hit=combat.round(unguarded,[{actor:'pilot',skill:'strike',target:'crawler'}]);
 assert.ok(guard.party[0].hp>hit.party[0].hp);
 assert.equal(guard.party[0].guarding,true);
});
test('poison inflicts deterministic damage and expires when duration reaches zero',()=>{
 const combat=make(skills),s=combat.begin([pilot()],[crawler()],44);
 const first=combat.round(s,[{actor:'pilot',skill:'pulse',target:'crawler'}]);
 assert.equal(first.foes[0].statuses.length,1);
 assert.equal(first.foes[0].statuses[0].turns,1);
 const second=combat.round(first,[{actor:'pilot',skill:'strike',target:'crawler'}]);
 assert.equal(second.foes[0].statuses.length,0);
 assert.ok(second.log.some(x=>x.includes('poison')));
});
test('elemental immunity prevents the associated damage',()=>{
 const combat=make(skills);
 const foe={...crawler(),resistances:{arc:0},hp:70,maxHp:70};
 const s=combat.begin([pilot()],[foe],65);
 const after=combat.round(s,[{actor:'pilot',skill:'pulse',target:'crawler'}]);
 assert.equal(after.foes[0].hp,70-3); // no arc hit, only poison tick
});
test('healing and status resource constraints respect caps',()=>{
 const combat=make(skills),p={...pilot(),hp:10};
 const s=combat.begin([p],[crawler()],12);
 const healed=combat.round(s,[{actor:'pilot',skill:'patch',target:'pilot'}]);
 assert.ok(healed.party[0].hp>10);
 assert.equal(healed.party[0].mp,4);
 assert.ok(healed.party[0].hp<=40);
});
test('victory, defeat and replay use exact deterministic outcomes',()=>{
 const combat=make(skills),enemy={...crawler(),hp:6,maxHp:6};
 const s=combat.begin([pilot()],[enemy],11);
 const won=combat.round(s,[{actor:'pilot',skill:'strike',target:'crawler'}]);
 assert.equal(won.phase,'victory');
 assert.equal(combat.round(won,[]),won);
 const doomed={...pilot(),hp:1,speed:0};
 const fast={...crawler(),speed:99};
 const loss=combat.begin([doomed],[fast],13);
 const defeated=combat.round(loss,[{actor:'pilot',skill:'strike',target:'crawler'}]);
 assert.equal(defeated.phase,'defeat');
 const reloaded=combat.restore(combat.serialize(s));
 assert.deepEqual(combat.round(s,[{actor:'pilot',skill:'strike',target:'crawler'}]),
   combat.round(reloaded,[{actor:'pilot',skill:'strike',target:'crawler'}]));
});
test('corrupt battle snapshots are rejected before simulation resumes',()=>{
 const combat=make(skills),s=combat.begin([pilot()],[crawler()],9);
 for(const raw of ['','null','{}','{broken',JSON.stringify({...s,version:2}),
   JSON.stringify({...s,party:[{...pilot(),hp:-1}]}),
   JSON.stringify({...s,foes:[{...crawler(),skills:['missing']}]}),
   JSON.stringify({...s,rng:0}),
   JSON.stringify({...s,phase:'victory'})])
   assert.equal(combat.restore(raw),null);
});

test('simultaneous poison knockouts resolve as draw rather than a false victory',()=>{
  const combat=make(skills);
  const state=combat.begin(
    [{...pilot(),hp:1,skills:['guard']}],
    [{...crawler(),hp:1,skills:['guard']}],77);
  state.party[0].statuses=[{type:'poison',turns:1,potency:1}];
  state.foes[0].statuses=[{type:'poison',turns:1,potency:1}];
  assert.equal(combat.validateState(state),true);
  const tied=combat.round(state,[{actor:'pilot',skill:'guard'}]);
  assert.equal(tied.phase,'draw');
  assert.equal(combat.round(tied,[]),tied);
  assert.equal(combat.restore(combat.serialize(tied)).phase,'draw');
});
