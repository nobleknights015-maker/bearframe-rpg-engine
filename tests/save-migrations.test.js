const test=require('node:test'),assert=require('node:assert/strict');
const create=require('../framework/save-migrations');
const steps={
  1:payload=>({...payload,state:{...payload.state,hp:payload.state.health,experience:0}}),
  2:payload=>({...payload,state:{...payload.state,level:1}})
};
test('reuses Engine v1 version chain to migrate save data without mutating originals',()=>{
 const m=create({schemaVersion:3,migrations:steps,
   validate:s=>Number.isInteger(s.hp)&&Number.isInteger(s.level)});
 assert.equal(m.canMigrate(1),true);
 assert.equal(m.canMigrate(2),true);
 assert.equal(m.canMigrate(3),true);
 assert.equal(m.canMigrate(4),false);
 const original={schemaVersion:1,project:'bearframe',state:{health:42},label:'slot-1'};
 const before=JSON.stringify(original);
 const result=m.migrate(original);
 assert.equal(JSON.stringify(original),before);
 assert.equal(result.schemaVersion,3);
 assert.equal(result.migratedFrom,1);
 assert.equal(result.state.hp,42);
 assert.equal(result.state.level,1);
 assert.equal(result.label,'slot-1');
 result.state.hp=1;
 assert.equal(original.state.health,42);
});
test('rejects missing version steps, future saves, corrupt payloads and unverified migrations',()=>{
 const incomplete=create({schemaVersion:3,migrations:{1:steps[1]}});
 assert.equal(incomplete.canMigrate(1),false);
 assert.throws(()=>incomplete.migrate({schemaVersion:1,state:{health:4}}),/Unsupported/);
 const m=create({schemaVersion:3,migrations:steps,validate:s=>s.hp>0});
 assert.throws(()=>m.migrate(null),/Invalid save payload/);
 assert.throws(()=>m.migrate({schemaVersion:999,state:{health:3}}),/Unsupported/);
 assert.throws(()=>m.migrate({schemaVersion:1,state:{health:0}}),/validation/);
});
test('migration callback cannot silently redirect a save to a different game',()=>{
 const m=create({schemaVersion:2,migrations:{1:p=>({...p,project:'other'})}});
 assert.throws(()=>m.migrate({schemaVersion:1,project:'bearframe',state:{hp:4}}),/owning project/);
});
test('new schema saves are validated and safely cloned',()=>{
 const m=create({schemaVersion:3,migrations:steps,validate:s=>s.level===1});
 const original={schemaVersion:3,project:'bearframe',state:{level:1}};
 const out=m.migrate(original);
 assert.deepEqual(out,original);
 assert.notEqual(out,original);
 assert.throws(()=>m.migrate({...original,state:{level:3}}),/state validation/);
 assert.throws(()=>create({schemaVersion:0}),/Positive schemaVersion/);
});
