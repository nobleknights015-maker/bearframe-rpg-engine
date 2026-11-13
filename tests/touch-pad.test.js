'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const create=require('../enginehost/touch-pad');
const fs=require('node:fs'),path=require('node:path');
function emitter(target){
  const listeners=new Map();
  target.addEventListener=(type,fn)=>{
    if(!listeners.has(type))listeners.set(type,[]);
    listeners.get(type).push(fn);
  };
  target.removeEventListener=(type,fn)=>{
    listeners.set(type,(listeners.get(type)||[]).filter(x=>x!==fn));
  };
  target.emit=(type,detail={})=>{
    const event={button:0,pointerId:1,detail:0,prevented:false,
      preventDefault(){this.prevented=true;},...detail};
    (listeners.get(type)||[]).slice().forEach(fn=>fn(event));
    return event;
  };
  return target;
}
function harness(dispatch){
  let now=0,id=0;
  const jobs=new Map(),doc=emitter({hidden:false});
  const win=emitter({
    setTimeout(fn,delay){const key=++id;jobs.set(key,{fn,when:now+delay});return key;},
    clearTimeout(key){jobs.delete(key);}
  });
  doc.defaultView=win;
  const moves=[],action=dispatch||function(direction){
    moves.push(direction);return {ok:true};
  };
  function button(direction){
    return emitter({ownerDocument:doc,disabled:false,
      getAttribute:name=>name==='data-party-world-dir'?direction:null,
      setPointerCapture(){},
    });
  }
  const up=button('up'),right=button('right');
  const pad=create([up,right],action,win);
  function advance(ms){
    const end=now+ms;
    for(let guard=0;guard<100;guard++){
      let candidate=null;
      for(const [key,item] of jobs)
        if(item.when<=end&&(!candidate||item.when<candidate.item.when))
          candidate={key,item};
      if(!candidate)break;
      jobs.delete(candidate.key);now=candidate.item.when;
      candidate.item.fn();
    }
    now=end;
  }
  return {up,right,doc,win,pad,moves,advance,jobs};
}
test('rapid touch taps issue exactly one canonical move per press, without ghost click',()=>{
  const h=harness();
  for(let i=0;i<15;i++){
    const start=h.right.emit('pointerdown',{pointerId:i+1,pointerType:'touch'});
    assert.equal(start.prevented,true);
    h.doc.emit('pointerup',{pointerId:i+1});
    const ghost=h.right.emit('click',{detail:1});
    assert.equal(ghost.prevented,true);
  }
  assert.deepEqual(h.moves,Array(15).fill('right'));
  h.right.emit('click',{detail:0}); // Keyboard/assistive activation.
  assert.equal(h.moves.length,16);
  h.pad.dispose();
});
test('held direction repeats only after intentional delay and stops on release',()=>{
  const h=harness();
  h.up.emit('pointerdown',{pointerId:7});
  assert.deepEqual(h.moves,['up']);
  h.advance(269);assert.equal(h.moves.length,1);
  h.advance(1);assert.equal(h.moves.length,2);
  h.advance(250);assert.equal(h.moves.length,4);
  // Another finger cannot steal the same D-pad.
  h.right.emit('pointerdown',{pointerId:8});
  assert.equal(h.moves.length,4);
  h.doc.emit('pointerup',{pointerId:7});
  h.advance(400);
  assert.equal(h.moves.length,4);
  h.right.emit('pointerdown',{pointerId:9});
  assert.equal(h.moves.at(-1),'right');
  h.doc.emit('pointercancel',{pointerId:9});
  h.advance(400);
  assert.equal(h.moves.length,5);
  h.pad.dispose();
});
test('app background, blur, disabled button, blocked move and lost capture cancel repeat',()=>{
  const h=harness();
  h.up.emit('pointerdown',{pointerId:1});
  h.doc.hidden=true;h.doc.emit('visibilitychange');
  h.advance(1500);assert.equal(h.moves.length,1);
  h.doc.hidden=false;
  h.up.emit('pointerdown',{pointerId:2});
  h.win.emit('blur');h.advance(1500);assert.equal(h.moves.length,2);
  h.up.emit('pointerdown',{pointerId:3});
  h.up.disabled=true;h.advance(270);assert.equal(h.moves.length,3);
  h.up.disabled=false;
  h.up.emit('pointerdown',{pointerId:4});
  h.up.emit('lostpointercapture',{pointerId:4});
  h.advance(1500);assert.equal(h.moves.length,4);
  assert.equal(h.pad.isHeld(),false);
  h.pad.dispose();
  h.up.emit('pointerdown',{pointerId:5});
  h.up.emit('click',{detail:0});
  assert.equal(h.moves.length,4,'disposed adapter cannot mutate state');
  const blocked=harness(()=>({ok:false,reason:'no-change'}));
  blocked.up.emit('pointerdown',{pointerId:10});
  blocked.advance(1000);
  assert.equal(blocked.pad.isHeld(),false);
  assert.equal(blocked.jobs.size,0);
  blocked.pad.dispose();
});
test('host pages load pad only for real gameplay and preserve normal button semantics',()=>{
  const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
  assert.match(read('enginehost/index.html'),/<script src="touch-pad\.js"><\/script>/);
  assert.match(read('enginehost/boot.js'),/createBearframeTouchPad\(/);
  assert.match(read('enginehost/host.css'),/touch-action:\s*none/);
  assert.match(read('enginehost/boot.js'),/function performPartyMovement\(dir\)/);
  assert.match(read('enginehost/boot.js'),/createBearframeTouchPad\(partyWorldButtons,\s*performPartyMovement\)/);
  assert.match(read('enginehost/boot.js'),/window\.BearframeHost\.navigate\(direction\)/);
});
