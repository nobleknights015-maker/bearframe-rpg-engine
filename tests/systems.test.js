const test=require('node:test'), assert=require('node:assert/strict');
const content=require('../game/world'), engine=require('../game/engine')(content);
const start=()=>engine.fresh('Moth','Ivory');
const act=(s,type,value)=>engine.step(s,{type,value});
const near=(tile,area,extras={})=>{
  const map=content.WORLD[area], y=map.rows.findIndex(r=>r.includes(tile)), x=map.rows[y].indexOf(tile);
  const s={...start(),area,x,y:y+1,...extras};
  return act(s,'move','up');
};
test('creation preserves a chosen identity and caps input',()=>{
  assert.equal(start().name,'Moth');assert.equal(start().finish,'Ivory');
  assert.equal(engine.fresh('   ').name,'Sleeper');
  assert.equal(engine.fresh('a'.repeat(40)).name.length,18);
  assert.throws(()=>engine.fresh('New','alien'));
});
test('cardinal motion, bounds, wall collision and input ownership',()=>{
  const s=start(),m=act(s,'move','right');assert.equal(m.x,4);assert.equal(s.x,3);
  assert.equal(act({...s,x:1,y:1},'move','up').y,1);
  assert.equal(act(s,'move','diagonal'),s);
  const p=near('G','pod');assert.equal(p.prompt,'G');assert.equal(act(p,'move','right'),p);
  assert.equal(act(p,'choose','fight'),p);assert.equal(act(p,'close').prompt,null);
});
test('legacy bearing is idempotent; core never appears as an equipment slot',()=>{
  const p=near('C','pod'),s=act(p,'choose','fit');
  assert.equal(s.hp,36);assert.equal(engine.hpMax(s),36);
  assert.equal(act({...s,prompt:'C'},'choose','fit').hp,36);
  assert.equal(act(p,'choose','core'),p);
  const m=near('T','gallery');assert.deepEqual(act(m,'choose','inspect').flags,m.flags);
  assert.equal(act(m,'choose','fit'),m);
});
test('weapon alone changes equipment appearance and both profiles equip',()=>{
  for(const w of ['blade','lance']){
    const p=near('C','pod'),s=act(p,'choose',w);assert.equal(s.weapon,w);assert.equal(s.finish,p.finish);
  }
});
test('recruitment, hostile alternative and player consent',()=>{
  for(const [tile,area,option,flag] of [['E','gallery','invite','echoAlly'],['D','ridge','escort','gridAlly']]){
    const p=near(tile,area);const ally=act(p,'choose',option);assert.ok(ally.flags[flag]);assert.ok(ally.flags[tile]);
    assert.ok(act(p,'choose','challenge').battle);assert.equal(act(p,'close').flags[flag],false);
  }
});
test('battle telegraph, pulse cost, guard, support and player withdrawal',()=>{
  const b=act(near('H','gallery'),'choose','fight');
  const r=act(b,'combat','pulse');assert.equal(r.battle.hp,12);assert.equal(r.hp,23);assert.equal(r.charge,1);
  const t=act(r,'combat','guard');assert.equal(t.hp,22);assert.equal(t.charge,2);assert.equal(t.battle.turn,3);
  const u=act(t,'combat','guard');assert.equal(u.hp,17);assert.equal(u.charge,3);
  const empty={...u,charge:0};assert.equal(act(empty,'combat','pulse'),empty);
  const ally={...b,flags:{...b.flags,E:true,echoAlly:true}};assert.equal(act(ally,'combat','strike').battle.hp,17);
  assert.equal(act(b,'combat','withdraw').battle,null);
});
test('defeat recovery, berth rest and battle victory',()=>{
  const b=act(near('H','gallery'),'choose','fight');
  const lost=act({...b,hp:1},'combat','strike');assert.deepEqual([lost.area,lost.x,lost.y,lost.hp],['pod',3,4,30]);
  assert.equal(act(lost,'rest').charge,3);
  const won=act(act(b,'combat','pulse'),'combat','pulse');assert.ok(won.flags.H);assert.equal(won.battle,null);
});
test('map transitions are reversible and the Hollow actually gates the ridge',()=>{
  const s={...start(),x:11,y:4},g=act(s,'move','right');assert.equal(g.area,'gallery');assert.equal(act(g,'move','left').area,'pod');
  const edge={...g,x:11};assert.equal(act(edge,'move','right').area,'gallery');
  edge.flags.H=true;const ridge=act(edge,'move','right');assert.equal(ridge.area,'ridge');assert.equal(act(ridge,'move','left').area,'gallery');
});
test('Mira offers two independent recording choices',()=>{
  const p=near('M','ridge');assert.match(act(p,'choose','name').message,/Moth/);
  const privateEnd=act(p,'choose','private');assert.ok(privateEnd.flags.met);assert.doesNotMatch(privateEnd.message,/Moth/);
});
test('save and load every playable mode, reject damaged state',()=>{
  for(const s of [start(),near('E','gallery'),act(near('H','gallery'),'choose','fight')])assert.deepEqual(engine.restore(JSON.stringify(s)),s);
  for(const bad of ['',null,'{}','null','{oops',...[
    {v:2},{name:12},{area:'constructor'},{x:0,y:0},{hp:0},{battle:{key:'H',hp:99,turn:1}},{flags:{}},{prompt:'unknown'}
  ].map(p=>JSON.stringify({...start(),...p}))])assert.equal(engine.restore(bad),null);
});
