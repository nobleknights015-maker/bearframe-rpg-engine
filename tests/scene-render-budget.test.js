'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const make=require('../framework/performance');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('bounded Engine v1 performance window reports successful render-work timings',()=>{
 const budget=make({profile:'balanced',windowSize:10});
 assert.equal(budget.snapshot().health.sampleCount,0);
 [3,5,8,20].forEach(ms=>budget.recordFrame(ms));
 const snap=budget.snapshot();
 assert.equal(snap.health.sampleCount,4);
 assert.equal(snap.health.averageMs,9);
 assert.equal(snap.health.p95Ms,20);
 assert.equal(snap.health.overBudgetRatio,.25);
 assert.equal(snap.health.healthy,false);
 assert.equal(snap.longFrames,0);
 assert.equal(snap.profile,'balanced');
 for(let i=0;i<10;i++)budget.recordFrame(4);
 assert.equal(budget.snapshot().health.sampleCount,10,
   'render telemetry must have a bounded memory footprint');
 assert.equal(budget.snapshot().health.p95Ms,4);
});
test('existing asset and visible sprite pressure contract remains independent of RPG saves',()=>{
 const budget=make({profile:'conservative',windowSize:10});
 assert.equal(budget.assess({loadedAssets:130,visibleSprites:90,visibleTiles:1100}).level,'high');
 assert.deepEqual(budget.noteMemoryWarning(),{action:'trim-assets',targetEntries:48});
 assert.equal(budget.snapshot().memoryWarnings,1);
 assert.deepEqual(budget.assess({loadedAssets:1,visibleSprites:1,visibleTiles:1}),null);
 assert.equal(budget.snapshot().pressure,null);
});
test('WebView loads real portable budget, measures composition and exposes diagnostics',()=>{
 const html=read('enginehost/index.html'),boot=read('enginehost/boot.js');
 const native=read('android/test/RouteRunner.java');
 assert.match(html,/src="\.\.\/framework\/performance\.js"/);
 assert.match(boot,/createBearframePerformanceBudget\(\{profile:'balanced',windowSize:120\}\)/);
 assert.match(boot,/sceneBudget\.recordFrame\(Math\.max\(0,performance\.now\(\)-workStarted\)\)/);
 assert.match(boot,/sceneBudget\.assess\(\{loadedAssets:assets\.snapshot\(\)\.loaded\.length/);
 assert.match(boot,/renderWork:sceneBudget\.snapshot\(\)/);
 assert.match(boot,/renderBudget:sceneBudget/);
 assert.match(native,/BearframeHost\.renderBudget\.snapshot\(\)/);
 assert.match(native,/Missing installed render-work samples/);
 assert.match(read('android/build.sh'),/framework\/\*\.js/);
});
