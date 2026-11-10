const test=require('node:test'),assert=require('node:assert/strict');
const decoder=require('../framework/legacy-save-v1');
const original=require('../game/engine')(require('../game/world'));
const start=()=>original.fresh('Legacy frame','Slate');
function fails(value){assert.throws(()=>decoder.decode(JSON.stringify(value)),TypeError);}
test('historical save v1 decoder accepts a genuine original engine snapshot without mutating it',()=>{
 const saved=start(),raw=JSON.stringify(saved);
 assert.ok(original.restore(raw),'original game must accept test source');
 const actual=decoder.decode(raw);
 assert.deepEqual(actual,saved);
 assert.equal(JSON.stringify(saved),raw);
 assert.deepEqual(decoder.inspect(raw),{
   ok:true,version:1,name:'Legacy frame',finish:'Slate',area:'pod',
   x:3,y:4,inBattle:false,hasPrompt:false
 });
});
test('legacy decoder retains exact battle, gear, flags and prompt envelope for future review',()=>{
 const valid=start();
 const battle={...valid,battle:{key:'H',hp:24,turn:2},prompt:null,
   flags:{...valid.flags,bearing:true},hp:36,weapon:'lance'};
 assert.ok(original.restore(JSON.stringify(battle)));
 assert.deepEqual(decoder.decode(JSON.stringify(battle)),battle);
 assert.equal(decoder.inspect(JSON.stringify(battle)).inBattle,true);
 const prompt={...valid,prompt:'G'};
 assert.ok(original.restore(JSON.stringify(prompt)));
 assert.equal(decoder.inspect(JSON.stringify(prompt)).hasPrompt,true);
});
test('legacy decoder rejects unsafe, altered or forward-incompatible source schemas',()=>{
 const s=start();
 for(const raw of [null,'','broken','{}','[]',JSON.stringify(s).repeat(50000)]){
   assert.deepEqual(decoder.inspect(raw),{ok:false,reason:'missing-or-incompatible'});
   assert.throws(()=>decoder.decode(raw),TypeError);
 }
 fails({...s,v:2});
 fails({...s,name:' '});
 fails({...s,finish:'Unknown'});
 fails({...s,area:'not-a-map'});
 fails({...s,x:999});
 fails({...s,y:-1});
 fails({...s,hp:31});
 fails({...s,charge:-1});
 fails({...s,weapon:'unknown'});
 fails({...s,message:'x'.repeat(1001)});
 fails({...s,extra:'unknown-future-property'});
 fails({...s,flags:{...s.flags,E:1}});
 fails({...s,flags:{...s.flags,echoAlly:true}});
 fails({...s,battle:{key:'H',hp:25,turn:1}});
 fails({...s,battle:{key:'H',hp:20,turn:1},prompt:'G'});
 fails({...s,prompt:'bogus'});
 fails({...s,flags:{...s.flags,extra:true}});
});
