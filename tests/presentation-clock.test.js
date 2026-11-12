const test=require('node:test'),assert=require('node:assert/strict');
const makeClock=require('../enginehost/presentation-clock');
const makeHost=require('../enginehost/party-world-host');
const project=require('../fixtures/party-world-project');
const theme={tileSize:32,clearColor:'#101018',
 atlases:{terrain:{width:64,height:32},characters:{width:64,height:48}},
 tiles:{floor:{atlas:'terrain',x:0,y:0,w:32,h:32},
  wall:{atlas:'terrain',x:32,y:0,w:32,h:32}},
 sprites:{
  player:{ticksPerFrame:5,frames:[
   {atlas:'characters',x:0,y:0,w:32,h:48},
   {atlas:'characters',x:32,y:0,w:32,h:48}]},
  eventMarker:{ticksPerFrame:1,frames:[
   {atlas:'characters',x:32,y:0,w:32,h:48}]}
 },
 eventSprites:{supply:'eventMarker',mechanic:'eventMarker',scout:'eventMarker'}
};
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
 const io=disk(),world=makeHost(io,project,theme);
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

test('failed initial animation scheduling leaves clock restartable without phantom loop',()=>{
 let attempts=0,scheduled=null;
 const clock=makeClock({requestFrame:fn=>{
  attempts++;
  if(attempts===1)throw Error('RAF unavailable');
  scheduled=fn;return 7;
 },cancelFrame:()=>{},paint:()=>{}});
 assert.throws(()=>clock.start(),/RAF unavailable/);
 assert.equal(clock.snapshot().running,false);
 assert.equal(clock.start(),true);
 assert.equal(clock.snapshot().running,true);
 scheduled(0);
 assert.equal(clock.snapshot().paints,0);
 clock.stop();
});

test('subsequent RAF scheduling failure stops clock and permits recovery',()=>{
 let requests=0,scheduled=null,errors=[];
 const clock=makeClock({requestFrame:fn=>{
  requests++;
  if(requests===3)throw Error('RAF lost after paint');
  scheduled=fn;return requests;
 },cancelFrame:()=>{},paint:()=>{},onError:e=>errors.push(e.message)});
 assert.equal(clock.start(),true);
 scheduled(0);
 assert.equal(clock.snapshot().running,true);
 scheduled(50);
 assert.deepEqual(errors,['RAF lost after paint']);
 assert.equal(clock.snapshot().running,false);
 assert.equal(clock.snapshot().failures,1);
 assert.equal(clock.snapshot().paints,1);
 assert.equal(clock.start(),true);
 assert.equal(clock.snapshot().running,true);
 clock.stop();
});

test('RAF cancellation failure cannot strand active clock or block restart',()=>{
 let next=0,queued=new Map(),errors=[];
 const clock=makeClock({
  requestFrame:fn=>{const id=++next;queued.set(id,fn);return id;},
  cancelFrame:id=>{queued.delete(id);throw Error('RAF cancel failed');},
  paint:()=>{},
  onError:error=>errors.push(error.message)
 });
 assert.equal(clock.start(),true);
 assert.equal(clock.stop(),true);
 assert.equal(clock.snapshot().running,false);
 assert.deepEqual(errors,['RAF cancel failed']);
 assert.equal(clock.snapshot().failures,1);
 assert.equal(clock.stop(),false);
 assert.equal(errors.length,1,'failed cancellation must not be retried');
 assert.equal(clock.start(),true);
 assert.equal(queued.size,1);
 const [id,fn]=queued.entries().next().value;
 queued.delete(id);fn(0);
 assert.equal(clock.snapshot().running,true);
 assert.equal(clock.stop(),true);
 assert.equal(clock.snapshot().running,false);
 assert.equal(clock.snapshot().failures,2);
});

test('stale RAF callback after stop/restart cannot paint or schedule a competing loop',()=>{
 let next=0,callbacks=new Map(),pending=new Set(),paints=[];
 const clock=makeClock({
  requestFrame:fn=>{const id=++next;callbacks.set(id,fn);pending.add(id);return id;},
  cancelFrame:id=>{pending.delete(id);},
  paint:tick=>{paints.push(tick);}
 });
 clock.start();
 const stale=callbacks.get(1);
 clock.stop();
 clock.start();
 assert.equal(pending.size,1);
 stale(1000);
 assert.equal(pending.size,1,'stale callback must not create a second loop');
 assert.deepEqual(paints,[]);
 const id=[...pending][0];
 pending.delete(id);callbacks.get(id)(0);
 assert.equal(pending.size,1);
 const id2=[...pending][0];
 pending.delete(id2);callbacks.get(id2)(50);
 assert.deepEqual(paints,[1]);
 assert.equal(pending.size,1);
 clock.stop();
});

test('paint-triggered stop and restart does not schedule a second RAF loop',()=>{
 let id=0,callbacks=new Map(),pending=new Set(),clock,paints=0;
 const requestFrame=fn=>{const next=++id;callbacks.set(next,fn);pending.add(next);return next;};
 const cancelFrame=handle=>pending.delete(handle);
 clock=makeClock({requestFrame,cancelFrame,paint:()=>{
  paints++;
  if(paints===1){assert.equal(clock.stop(),true);assert.equal(clock.start(),true);}
 }});
 clock.start();
 function fire(time){
  const handle=[...pending][0];assert.ok(handle);
  pending.delete(handle);callbacks.get(handle)(time);
 }
 fire(0);fire(50);
 assert.equal(paints,1);
 assert.equal(pending.size,1,'restarted loop must own exactly one callback');
 fire(100);
 assert.equal(pending.size,1,'new lifecycle establishes a fresh baseline');
 fire(150);
 assert.equal(paints,2);
 assert.equal(pending.size,1);
 clock.stop();
 assert.equal(pending.size,0);
});

test('throwing diagnostic observer cannot strand clock after frame failure or cancellation',()=>{
 let next=0,callbacks=new Map(),pending=new Set(),errors=0,paintFails=true;
 const clock=makeClock({
  requestFrame:fn=>{const id=++next;callbacks.set(id,fn);pending.add(id);return id;},
  cancelFrame:id=>{pending.delete(id);throw Error('cancel failed');},
  paint:()=>{if(paintFails)throw Error('paint failed');},
  onError:()=>{errors++;throw Error('observer failed');}
 });
 const fire=time=>{
  const id=[...pending][0];assert.ok(id);
  pending.delete(id);callbacks.get(id)(time);
 };
 clock.start();fire(0);
 assert.doesNotThrow(()=>fire(50));
 assert.equal(clock.snapshot().running,false);
 assert.equal(clock.snapshot().failures,1);
 assert.equal(errors,1);
 paintFails=false;
 assert.equal(clock.start(),true);
 assert.doesNotThrow(()=>clock.stop());
 assert.equal(clock.snapshot().running,false);
 assert.equal(clock.snapshot().failures,2);
 assert.equal(errors,2);
 assert.equal(clock.start(),true);
 assert.doesNotThrow(()=>clock.stop());
});
