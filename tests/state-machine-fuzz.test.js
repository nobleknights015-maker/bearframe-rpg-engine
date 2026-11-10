const test=require('node:test'), assert=require('node:assert/strict');
const world=require('../game/world');
const engine=require('../game/engine')(world);
function random(seed) {
  let n=seed >>> 0;
  return function(limit) {
    n^=n<<13;n^=n>>>17;n^=n<<5;
    return (n>>>0)%limit;
  };
}
const commands=[
  ...['up','right','down','left','diagonal',''].map(value=>({type:'move',value})),
  ...['strike','pulse','guard','withdraw',''].map(value=>({type:'combat',value})),
  ...['listen','fit','blade','lance','invite','challenge','fight','escort','inspect','name','private','unknown'].map(value=>({type:'choose',value})),
  {type:'rest',value:''},{type:'close',value:''},{type:'unknown',value:'something'}
];
test('thousands of reproducible commands preserve a valid restorable state',()=>{
  for(let seed=1;seed<=40;seed++) {
    const pick=random(seed);
    let state=engine.fresh('Trace'+seed,'Slate');
    for(let i=0;i<200;i++) {
      const command=commands[pick(commands.length)];
      const before=JSON.stringify(state);
      const next=engine.step(state,command);
      assert.equal(JSON.stringify(state),before,'simulation mutated its input');
      assert.deepEqual(engine.restore(JSON.stringify(next)),next,'simulation produced an un-restorable state at seed '+seed+' step '+i);
      state=next;
    }
  }
});
test('independent engines replay exactly the same command history',()=>{
  const first=require('../game/engine')(world), second=require('../game/engine')(world);
  for(let seed=1;seed<=12;seed++) {
    const pick=random(seed*7919), a=first.fresh('Replay','Ivory'), b=second.fresh('Replay','Ivory');
    let left=a,right=b;
    for(let i=0;i<150;i++) {
      const command=commands[pick(commands.length)];
      left=first.step(left,command);right=second.step(right,command);
      assert.deepEqual(left,right,'diverged at seed '+seed+' step '+i);
    }
  }
});
