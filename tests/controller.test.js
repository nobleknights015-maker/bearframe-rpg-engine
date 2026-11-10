const test=require('node:test'),assert=require('node:assert/strict');
const create=require('../framework/controller');
function frame(axes=[0,0],pressed=[],connected=true){
 const buttons=Array.from({length:16},(_,i)=>({pressed:pressed.includes(i),value:pressed.includes(i)?1:0}));
 return {connected,axes,buttons};
}
test('standard South/East face buttons fire one-shot confirmation and cancellation',()=>{
 const c=create();
 assert.deepEqual(c.poll(frame([0,0],[0]),0),[{type:'confirm'}]);
 assert.deepEqual(c.poll(frame([0,0],[0]),20),[]);
 assert.deepEqual(c.poll(frame([0,0],[0,1]),40),[{type:'cancel'}]);
 assert.deepEqual(c.poll(frame(),60),[]);
 assert.deepEqual(c.poll(frame([0,0],[0]),80),[{type:'confirm'}]);
});
test('Xbox/PlayStation/Switch-style standard Gamepad indices map to engine actions',()=>{
 const c=create();
 assert.deepEqual(c.poll(frame([0,0],[2,3,4,5,8,9]),0),
  [{type:'menu'},{type:'map'},{type:'previous-tab'},{type:'next-tab'},{type:'map'},{type:'pause'}]);
});
test('D-pad overrides left stick and repeats at a controlled interval',()=>{
 const c=create({repeatDelayMs:250,repeatIntervalMs:100});
 assert.deepEqual(c.poll(frame([0.99,0],[12]),0),[{type:'navigate',direction:'up'}]);
 assert.deepEqual(c.poll(frame([0.99,0],[12]),249),[]);
 assert.deepEqual(c.poll(frame([0.99,0],[12]),250),[{type:'navigate',direction:'up'}]);
 assert.deepEqual(c.poll(frame([0.99,0],[12]),340),[]);
 assert.deepEqual(c.poll(frame([0.99,0],[12]),350),[{type:'navigate',direction:'up'}]);
 assert.deepEqual(c.poll(frame([0.99,0],[15]),360),[{type:'navigate',direction:'right'}]);
});
test('stick deadzone, release hysteresis and neutral reset prevent jitter',()=>{
 const c=create();
 assert.deepEqual(c.poll(frame([0.40,0]),0),[]);
 assert.deepEqual(c.poll(frame([0.50,0]),15),[{type:'navigate',direction:'right'}]);
 assert.deepEqual(c.poll(frame([0.32,0]),80),[]);
 assert.deepEqual(c.poll(frame([0.29,0]),120),[]);
 assert.deepEqual(c.poll(frame([0.32,0]),130),[]);
 assert.deepEqual(c.poll(frame([0.6,0]),140),[{type:'navigate',direction:'right'}]);
});
test('the stronger axis wins for diagonal directions, switching direction immediately',()=>{
 const c=create();
 assert.deepEqual(c.poll(frame([0.6,-0.9]),0),[{type:'navigate',direction:'up'}]);
 assert.deepEqual(c.poll(frame([0.91,0.6]),33),[{type:'navigate',direction:'right'}]);
 assert.deepEqual(c.poll(frame([0,0.8]),70),[{type:'navigate',direction:'down'}]);
});
test('disconnect or app suspend clears held navigation and button latches',()=>{
 const c=create();
 c.poll(frame([0,0.95],[0]),0);
 assert.deepEqual(c.poll(null,50),[]);
 assert.deepEqual(c.poll(frame([0,0.95],[0]),60),
  [{type:'navigate',direction:'down'},{type:'confirm'}]);
 c.clear();
 assert.deepEqual(c.poll(frame([0,0.95],[0]),70),
  [{type:'navigate',direction:'down'},{type:'confirm'}]);
});
test('invalid clock values reject rather than creating uncontrolled repeats',()=>{
 const c=create();
 assert.throws(()=>c.poll(frame(),NaN),/monotonic/);
 assert.throws(()=>c.poll(frame(),-1),/monotonic/);
});
