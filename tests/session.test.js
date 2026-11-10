const test=require('node:test'), assert=require('node:assert/strict');
const create=require('../framework/session');
const project=require('../fixtures/engine-project');
const theme={tileSize:32,clearColor:'#101018',
 atlases:{terrain:{width:64,height:32},characters:{width:64,height:48}},
 tiles:{floor:{atlas:'terrain',x:0,y:0,w:32,h:32},wall:{atlas:'terrain',x:32,y:0,w:32,h:32}},
 sprites:{player:{ticksPerFrame:5,frames:[{atlas:'characters',x:0,y:0,w:32,h:48}]}}};
function storage() {
 const data=Object.create(null);
 let fail=false;
 return {data, read:key=>data[key]||null,
   write:(key,value)=>{if(fail)return false;data[key]=value;return true;},
   fail:yes=>{fail=yes;}};
}
test('unified session starts and resumes identical state from durable Android-style slots',()=>{
 const disk=storage(),a=create(project,disk,theme,{slotPrefix:'engine-session-unit'});
 assert.equal(a.resume().reason,'no-save');
 assert.equal(a.start('Pilot',17).ok,true);
 const first=a.snapshot();
 assert.equal(first.started,true);assert.equal(first.view.x,1);
 assert.equal(a.dispatch({type:'move',dir:'down'}).ok,true);
 const after=a.snapshot();
 assert.equal(after.view.y,2);assert.equal(after.view.sequence,1);
 assert.equal(a.start('Other').reason,'existing-save');
 const b=create(project,disk,theme,{slotPrefix:'engine-session-unit'});
 assert.equal(b.resume().ok,true);
 assert.deepEqual(b.snapshot().view,after.view);
 assert.equal(b.serialize(),a.serialize());
});
test('failed commit never shows advanced simulation state and survives app restart',()=>{
 const disk=storage(),session=create(project,disk,theme);
 assert.equal(session.start('Pilot').ok,true);
 const before=session.snapshot().view;
 disk.fail(true);
 assert.equal(session.dispatch({type:'move',dir:'down'}).reason,'write-failed');
 assert.deepEqual(session.snapshot().view,before);
 const second=create(project,disk,theme);
 assert.equal(second.resume().ok,true);
 assert.deepEqual(second.snapshot().view,before);
});
test('invalid gameplay command is a no-op, and renderer has no state side effects',()=>{
 const disk=storage(),s=create(project,disk,theme);
 s.start('Pilot',42);
 const first=s.serialize();
 assert.equal(s.dispatch({type:'move',dir:'invalid'}).reason,'no-change');
 const frame=s.compose({width:96,height:96,tick:3});
 assert.ok(frame.commands.some(cmd=>cmd.actor==='player'));
 assert.equal(first,s.serialize());
 assert.throws(()=>create(project,disk,null).compose({width:96,height:96}),/rendering unavailable/);
});
test('journal detects conflicting saved revisions and refuses starting or dispatching',()=>{
 const disk=storage(),s=create(project,disk,theme,{slotPrefix:'journal-conflict'});
 s.start('Pilot',19);
 let view=s.snapshot();
 const keys=Object.keys(disk.data);
 assert.equal(keys.length,1);
 const other=storage(),second=create(project,other,theme,{slotPrefix:'journal-conflict'});
 second.start('Other',21);
 disk.data[keys[0].replace(':a',':b')]=other.data[keys[0]];
 const recovered=create(project,disk,theme,{slotPrefix:'journal-conflict'});
 assert.equal(recovered.resume().reason,'save-conflict');
 assert.equal(recovered.start('New').reason,'existing-save');
 assert.equal(recovered.snapshot().started,false);
 assert.equal(s.snapshot().view.sequence,view.view.sequence);
});
test('separate game names and slots do not cross-save',()=>{
 const disk=storage(),a=create(project,disk,theme,{slotPrefix:'bf:save-1'});
 const b=create(project,disk,theme,{slotPrefix:'bf:save-2'});
 assert.equal(a.start('A').ok,true);
 assert.equal(b.resume().reason,'no-save');
 assert.equal(b.start('B').ok,true);
 assert.equal(a.snapshot().view.sequence,0);
 assert.notEqual(a.serialize(),b.serialize());
});

test('corrupted occupied save is never mistaken for a first launch',()=>{
 const disk=storage(),first=create(project,disk,theme,{slotPrefix:'bf:corrupt:v1'});
 assert.equal(first.start('Owner',4).ok,true);
 const slot=Object.keys(disk.data)[0];
 disk.data[slot]='{invalid-json';
 const reopened=create(project,disk,theme,{slotPrefix:'bf:corrupt:v1'});
 assert.equal(reopened.resume().reason,'unreadable-save');
 assert.equal(reopened.start('Replacement',5).reason,'unreadable-save');
 assert.equal(disk.data[slot],'{invalid-json');
 assert.equal(reopened.snapshot().journal.occupiedSlots,1);
 assert.equal(reopened.snapshot().journal.validSlots,0);
});
