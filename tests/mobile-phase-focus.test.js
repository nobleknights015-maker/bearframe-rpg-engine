const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
test('pending world event or encounter visibly focuses a real available action',()=>{
 const boot=source('enginehost/boot.js'),java=source('android/test/RouteRunner.java');
 assert.match(boot,/previousRuntimeMode/);
 assert.match(boot,/if\(currentMode!==previousRuntimeMode\)/);
 assert.match(boot,/nextAction\.focus\(\)/);
 assert.match(boot,/nextAction\.scrollIntoView\(\{block:'nearest'\}\)/);
 assert.match(boot,/movement is paused/);
 assert.match(java,/document\.activeElement\.hasAttribute\('data-event-choice'\)/);
 assert.match(java,/document\.activeElement\.hasAttribute\('data-runtime-combat'\)/);
});
