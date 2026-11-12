const test=require('node:test'),assert=require('node:assert/strict');
const makeClock=require('../enginehost/presentation-clock');
const makeHost=require('../enginehost/party-world-host');
const project=require('../fixtures/party-world-project');
function scheduler(){
 let nextId=0,queue=new Map(),cancelled=0;
 return {requestFrame(fn){const id=++nextId;queue.set(id,fn);return id;},
  cancelFrame(id){if(queue.delete(id))cancelled++;},
  fire(time){const [id,fn]=queue.entries().next().value||[];
   if(!fn)throw Error('no scheduled frame');
   queue.delete(id);fn(time);},
  pending(){return queue.size;},cancelled(){return cancelled;}};
}
function disk(){
 let data=new Map(),writes=0;
 return {read:k=>data.has(k)?data.get(k):null,
  write:(k,v)=>{data.set(k,v);writes++;return true;},
  writes:()=>writes};
}
test('idle scene clock advances visual pose without touching v2 saved state',()=>{
 const io=disk(),world=makeHost(io,project);
 const before=world.snapshot(),writes=io.writes();
 const p=[];
 const raf=scheduler(),clock=makeClock({
  intervalMs:50,requestFrame:raf.requestFrame,cancelFrame:raf.cancelFrame,
  paint:tick=>{
   const scene=world.compose({width:224,height:160,tick});
   const actor=scene.commands.find(c=>c.actor==='player');
   p.push({tick,x:actor.source.x,revision:world.view().sequence});
  }});
 assert.equal(clock.start(),true);
 assert.equal(clock.start(),false,'must not schedule a second concurrent loop');
 assert.equal(raf.pending(),1);
 raf.fire(0);
 raf.fire(49);
 assert.equal(p.length,0);
 raf.fire(50);
 raf.fire(250);
 assert.deepEqual(p.map(x=>x.tick),[1,5]);
 assert.notEqual(p[0].x,p[1].x,'idle animation really changed displayed source frame');
 assert.equal(world.view().sequence,before.view.sequence);
 assert.deepEqual(world.snapshot(),before);
 assert.equal(io.writes(),writes,'RAF must never save');
 assert.equal(world.verifySave().ok,true);
 assert.equal(clock.snapshot().paints,2);
 clock.stop();
 assert.equal(raf.pending(),0);
});
test('pause and resume discard time while hidden and never stack RAF callbacks',()=>{
 const raf=scheduler(),frames=[];
 const clock=makeClock({intervalMs:50,requestFrame:raf.requestFrame,
  cancelFrame:raf.cancelFrame,paint:tick=>frames.push(tick)});
 clock.start();raf.fire(0);raf.fire(50);
 assert.deepEqual(frames,[1]);
 assert.equal(clock.stop(),true);assert.equal(clock.stop(),false);
 assert.equal(raf.pending(),0);assert.equal(raf.cancelled(),1);
 clock.start();raf.fire(50000);
 assert.deepEqual(frames,[1],'first resume frame is a new baseline');
 raf.fire(50049);assert.deepEqual(frames,[1]);
 raf.fire(50050);assert.deepEqual(frames,[1,2]);
 assert.equal(clock.snapshot().running,true);
});
test('an animation draw failure safely stops the loop and exposes error',()=>{
 const raf=scheduler();let errors=0;
 const clock=makeClock({requestFrame:raf.requestFrame,
  cancelFrame:raf.cancelFrame,paint:()=>{throw Error('context lost');},
  onError:e=>{assert.match(e.message,/context lost/);errors++;}});
 clock.start();raf.fire(0);raf.fire(50);
 assert.equal(errors,1);assert.equal(raf.pending(),0);
 assert.deepEqual(clock.snapshot(),{running:false,tick:1,paints:0,
  failures:1,intervalMs:50});
 assert.throws(()=>makeClock({paint:()=>{},intervalMs:2,
  requestFrame:raf.requestFrame,cancelFrame:raf.cancelFrame}),/16..1000/);
});
test('offline WebView embeds and runs live presentation clock with lifecycle gate',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const html=read('enginehost/index.html'),boot=read('enginehost/boot.js');
 const java=read('android/test/RouteRunner.java');
 assert.match(html,/presentation-clock\.js/);
 for(const token of ['createBearframePresentationClock',
  'paintPartyWorldFrame(tick)','presentationClock:partyWorldClock',
  "partyWorldScreens.current()==='world'",
  "document.addEventListener('visibilitychange'",
  "window.addEventListener('pagehide'",
  'partyWorldClock.stop()'])
  assert.ok(boot.includes(token),'Missing host presentation clock: '+token);
 assert.match(java,/checkUnifiedPresentationClock\(\)/);
 assert.match(java,/presentationClock\.snapshot\(\)/);
});
