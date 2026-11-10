const test=require('node:test'),assert=require('node:assert/strict');
const legacy=require('../framework/legacy-save-v1');
const world=require('../game/world');
const old=require('../game/engine')(world);
test('all historical v1 world tiles match the original save-restoration acceptance boundary',()=>{
 let compared=0,open=0,blocked=0;
 for(const area of Object.keys(world.WORLD)){
  const rows=world.WORLD[area].rows;
  rows.forEach((row,y)=>{
   for(let x=0;x<row.length;x++){
    const s=old.fresh('Tile sweep','Ivory');
    s.area=area;s.x=x;s.y=y;
    const raw=JSON.stringify(s);
    const original=!!old.restore(raw);
    const updated=legacy.inspect(raw).ok;
    assert.equal(updated,original,'geometry mismatch '+area+' '+x+','+y);
    compared++;if(original)open++;else blocked++;
   }
  });
 }
 assert.equal(compared,312);assert.ok(open>150);assert.ok(blocked>0);
});
test('historical prompts and battle foe snapshots are accepted only when the real original game accepts them',()=>{
 for(const code of Object.keys(world.ACTIONS)){
  const s=old.fresh('Prompt sweep');s.prompt=code;
  assert.equal(!!old.restore(JSON.stringify(s)),true);
  assert.equal(legacy.inspect(JSON.stringify(s)).ok,true);
 }
 for(const [key,foe] of Object.entries(world.FOES)){
  const s=old.fresh('Foe sweep');s.battle={key,hp:foe.hp,turn:100};
  assert.equal(!!old.restore(JSON.stringify(s)),true);
  assert.equal(legacy.inspect(JSON.stringify(s)).ok,true);
  s.battle.hp=foe.hp+1;
  assert.equal(!!old.restore(JSON.stringify(s)),false);
  assert.equal(legacy.inspect(JSON.stringify(s)).ok,false);
 }
});
