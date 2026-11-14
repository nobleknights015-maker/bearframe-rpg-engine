'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const makeClock=require('../enginehost/presentation-clock');
const fs=require('node:fs'),path=require('node:path');
function scheduler(){
 let id=0,active=new Map(),callbacks=new Map();
 return {
  requestFrame(fn){const next=++id;callbacks.set(next,fn);active.set(next,fn);return next;},
  cancelFrame(key){active.delete(key);},
  fire(time){
   const item=active.entries().next().value;
   assert.ok(item,'No scheduled RAF callback');
   active.delete(item[0]);item[1](time);
  },
  snapshot(){return {active:active.size,callbacks:[...callbacks.values()]};}
 };
}
test('callback pacing is independent from 50ms painting throttle and bounded to 120 samples',()=>{
 const raf=scheduler(),clock=makeClock({requestFrame:raf.requestFrame,
   cancelFrame:raf.cancelFrame,intervalMs:50,paint:()=>true});
 assert.deepEqual(clock.pacingSnapshot(),{
   sampleCount:0,averageCallbackMs:0,p95CallbackMs:0,
   maxCallbackMs:0,gapsOver33Ms:0,gapsOver50Ms:0,callbackRateHz:0
 });
 clock.start();
 for(let i=0;i<=180;i++)raf.fire(i*16);
 const pacing=clock.pacingSnapshot();
 assert.equal(pacing.sampleCount,120);
 assert.equal(pacing.averageCallbackMs,16);
 assert.equal(pacing.p95CallbackMs,16);
 assert.equal(pacing.maxCallbackMs,16);
 assert.equal(pacing.gapsOver33Ms,0);
 assert.equal(pacing.callbackRateHz,62.5);
 assert.ok(clock.snapshot().paints<60,
   'RAF callbacks must not be mistaken for actual Canvas paints');
 clock.stop();
});
test('hitches appear in delivered RAF callback intervals, without claiming display FPS',()=>{
 const raf=scheduler(),clock=makeClock({requestFrame:raf.requestFrame,
   cancelFrame:raf.cancelFrame,paint:()=>true});
 clock.start();
 for(const timestamp of [0,16,32,48,64,80,150,225,241,257,273,289])
   raf.fire(timestamp);
 const p=clock.pacingSnapshot();
 assert.equal(p.sampleCount,11);
 assert.equal(p.gapsOver33Ms,2);
 assert.equal(p.gapsOver50Ms,2);
 assert.equal(p.maxCallbackMs,75);
 assert.ok(p.p95CallbackMs>=70);
 assert.ok(p.averageCallbackMs>16);
 assert.ok(p.callbackRateHz>0);
 clock.stop();
});
test('visibility stop/restart does not record suspended time as a giant hitch',()=>{
 const raf=scheduler(),clock=makeClock({requestFrame:raf.requestFrame,
   cancelFrame:raf.cancelFrame,paint:()=>true});
 clock.start();raf.fire(100);raf.fire(116);
 assert.equal(clock.pacingSnapshot().sampleCount,1);
 clock.stop();
 clock.start();raf.fire(100000); // resumed baseline
 assert.equal(clock.pacingSnapshot().sampleCount,1);
 raf.fire(100016);
 assert.equal(clock.pacingSnapshot().sampleCount,2);
 assert.equal(clock.pacingSnapshot().gapsOver50Ms,0);
 clock.stop();
});
test('stale, duplicate, reversed and oversized timestamps do not pollute pacing samples',()=>{
 const raf=scheduler(),clock=makeClock({requestFrame:raf.requestFrame,
   cancelFrame:raf.cancelFrame,paint:()=>true});
 clock.start();const stale=raf.snapshot().callbacks[0];
 raf.fire(0);raf.fire(16);
 stale(5000);
 raf.fire(15); // valid scheduler, reversed timestamp: reject negative gap
 raf.fire(70000); // absurd gap: excluded from callback cadence window
 raf.fire(70016);
 assert.equal(clock.pacingSnapshot().sampleCount,2);
 assert.ok(clock.pacingSnapshot().maxCallbackMs<=16);
 assert.equal(raf.snapshot().active,1);
 clock.stop();
});
test('Android host surfaces callback cadence separately from scene CPU work and preserves saves',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const boot=read('enginehost/boot.js'),
       java=read('android/test/RouteRunner.java'),
       clock=read('enginehost/presentation-clock.js');
 assert.match(clock,/callbackLimit=120/);
 assert.match(boot,/framePacing:partyWorldClock\.pacingSnapshot\(\)/);
 assert.match(java,/BearframeHost\.presentationClock\.pacingSnapshot\(\)/);
 assert.match(java,/Installed frame pacing callback telemetry failed/);
 assert.doesNotMatch(clock,/session\.dispatch|journal\.write|localStorage\.setItem/);
});
