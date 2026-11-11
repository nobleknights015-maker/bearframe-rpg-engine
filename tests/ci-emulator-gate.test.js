const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/engine-ci.yml'),'utf8');

test('installed Android emulator acceptance is not skipped on normal pushes',()=>{
  for(const name of ['Enable KVM for Android emulator','Run installed-app two-process recovery on Android emulator']){
    const start=workflow.indexOf('      - name: '+name+'\n');
    assert.ok(start>=0,'missing required emulator step: '+name);
    const next=workflow.indexOf('      - name: ',start+8);
    const section=workflow.slice(start,next<0?undefined:next);
    assert.doesNotMatch(section,/^\s+if:/m,'emulator step must run for normal main pushes');
  }
  assert.match(workflow,/stage unified-mobile-flow-first/);
  assert.match(workflow,/stage unified-mobile-flow-second/);
  assert.match(workflow,/route=PASS unified-mobile-flow-first/);
  assert.match(workflow,/route=PASS unified-mobile-flow-second/);
  assert.match(workflow,/stage unified-memory/);
});
