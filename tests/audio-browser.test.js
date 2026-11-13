const test=require('node:test'),assert=require('node:assert/strict');
const create=require('../framework/audio-browser');
const director=require('../framework/audio');
function rig(options={}){
  const elements=[];
  function factory(tag){
    assert.equal(tag,'audio');
    const e={src:'',volume:1,loop:false,preload:null,paused:false,
      currentTime:0,playCount:0,pauses:0,loads:0,
      async play(){this.playCount++;
        if(options.rejectPlay)throw new Error('gesture required');
        this.paused=false;
      },
      pause(){this.pauses++;this.paused=true;},
      load(){this.loads++;},
      removeAttribute(name){if(name==='src')this.src='';}};
    elements.push(e);return e;
  }
  return {elements,backend:create(factory,options)};
}
const music=(id='theme')=>({type:'play',bus:'music',id,
  path:'audio/music/theme.ogg',loop:true,gain:80});
const sfx=(id='impact')=>({type:'play',bus:'sfx',id,
  path:'audio/sfx/impact.wav',loop:false,gain:65});
test('plays, pauses, resumes, replaces, and stops music via offline assets',async()=>{
 const {backend,elements}=rig({assetPrefix:'enginehost/assets/'});
 assert.deepEqual(await backend.execute([music()]),[{ok:true}]);
 assert.equal(backend.status().music,'theme');
 assert.equal(elements[0].src,'enginehost/assets/audio/music/theme.ogg');
 assert.equal(elements[0].volume,.8);
 assert.equal(elements[0].loop,true);
 await backend.execute([{type:'pause',bus:'music',id:'theme'}]);
 assert.equal(elements[0].paused,true);
 await backend.execute([{type:'resume',bus:'music',id:'theme'}]);
 assert.equal(elements[0].playCount,2);
 await backend.execute([music('new-theme')]);
 assert.equal(backend.status().music,'new-theme');
 assert.equal(elements[0].src,'');
 assert.equal(elements[0].pauses,2);
 assert.equal(elements[1].playCount,1);
 await backend.execute([{type:'stop',bus:'music',id:'new-theme'}]);
 assert.equal(backend.status().music,null);
 assert.equal(elements[1].src,'');
});
test('caps concurrent sound effects, cleans ended sounds and disposes safely',async()=>{
 const {backend,elements}=rig({maxSfxVoices:2});
 await backend.execute([sfx('one'),sfx('two'),sfx('three')]);
 assert.equal(backend.status().activeSfx,2);
 assert.equal(elements[0].src,'');
 assert.equal(elements[0].pauses,1);
 elements[1].onended();
 assert.equal(backend.status().activeSfx,1);
 assert.equal(elements[1].src,'');
 backend.dispose();
 assert.equal(backend.status().destroyed,true);
 assert.equal(backend.status().activeSfx,0);
 assert.equal(elements[2].src,'');
 assert.deepEqual(await backend.execute([music()]),[{ok:false,reason:'destroyed'}]);
 backend.dispose();
});
test('respects channel-gain changes and explicit muting without state mutation',async()=>{
 const {backend,elements}=rig();
 await backend.execute([music(),sfx()]);
 await backend.execute([{type:'gain',bus:'music',gain:25},
   {type:'gain',bus:'sfx',gain:0}]);
 assert.equal(elements[0].volume,.25);
 assert.equal(elements[1].volume,0);
 await backend.execute([{type:'gain',bus:'sfx',gain:40}]);
 assert.equal(elements[1].volume,.4);
 assert.equal((await backend.execute([{type:'gain',bus:'music',gain:101}]))[0].reason,'invalid-gain');
 assert.equal(elements[0].volume,.25);
});
test('rejects path traversal, remote URLs, invalid factories and unrecognized commands',async()=>{
 assert.throws(()=>create(null),/factory/);
 assert.throws(()=>create(()=>null, {assetPrefix:'https://remote/'}),/Local audio asset prefix/);
 const {backend,elements}=rig();
 for(const path of ['../secrets.wav','https://evil/a.wav','audio/../bad.wav',
   '/absolute/track.ogg','audio/track.svg']){
   const result=await backend.execute([{...music(),path}]);
   assert.equal(result[0].reason,'invalid-asset');
 }
 assert.equal(elements.length,0);
 assert.equal((await backend.execute([{type:'unknown'}]))[0].reason,'unknown-command');
 await assert.rejects(backend.execute(Array.from({length:65},()=>sfx())),/at most 64/);
});
test('new play commands after gain changes do not apply volume twice',async()=>{
 const {backend,elements}=rig();
 await backend.execute([{type:'gain',bus:'music',gain:35}]);
 await backend.execute([music()]);
 assert.equal(elements[0].volume,.8);
 await backend.execute([{type:'gain',bus:'music',gain:35}]);
 assert.equal(elements[0].volume,.35);
 await backend.execute([{...music('replacement'),gain:35}]);
 assert.equal(elements[1].volume,.35);
});
test('reports autoplay rejection without unhandled promise and frees failed SFX',async()=>{
 const {backend}=rig({rejectPlay:true});
 const m=await backend.execute([music()]);
 assert.equal(m[0].reason,'play-rejected');
 const fx=await backend.execute([sfx()]);
 assert.equal(fx[0].reason,'play-rejected');
 assert.equal(backend.status().activeSfx,0);
 backend.dispose();
});
test('consumes real platform-neutral audio director commands',async()=>{
 const catalog={theme:{type:'music',path:'audio/music/theme.ogg'},
   effect:{type:'sfx',path:'audio/sfx/effect.wav'}};
 const d=director(catalog),{backend,elements}=rig();
 let s=d.fresh();
 let action=d.apply(s,{type:'music',id:'theme'});s=action.state;
 assert.equal((await backend.execute(action.commands))[0].ok,true);
 action=d.apply(s,{type:'volume',bus:'music',value:50});s=action.state;
 await backend.execute(action.commands);
 assert.equal(elements[0].volume,.5);
 action=d.apply(s,{type:'pause'});s=action.state;
 await backend.execute(action.commands);
 assert.equal(elements[0].paused,true);
 action=d.apply(s,{type:'resume'});s=action.state;
 await backend.execute(action.commands);
 assert.equal(elements[0].paused,false);
 action=d.apply(s,{type:'stopMusic'});
 await backend.execute(action.commands);
 assert.equal(backend.status().music,null);
});

test('serializes concurrent batches so a later stop cannot overtake play',async()=>{
 let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const elements=[];
 const backend=create(()=>{
   const e={src:'',volume:1,loop:false,currentTime:0,
     play(){return gate;},pause(){},load(){},
     removeAttribute(){this.src='';}};
   elements.push(e);return e;
 });
 const started=backend.execute([music()]);
 const stopped=backend.execute([{type:'stop',bus:'music',id:'theme'}]);
 await Promise.resolve();
 await Promise.resolve();
 assert.equal(elements.length,1);
 assert.equal(backend.status().music,'theme');
 release();
 assert.deepEqual(await started,[{ok:true}]);
 assert.deepEqual(await stopped,[{ok:true}]);
 assert.equal(backend.status().music,null);
 assert.equal(elements[0].src,'');
});
test('cleans failed music autoplay and does not leak a stale playing track',async()=>{
 const {backend,elements}=rig({rejectPlay:true});
 const result=await backend.execute([music()]);
 assert.equal(result[0].reason,'play-rejected');
 assert.equal(backend.status().music,null);
 assert.equal(elements[0].src,'');
 assert.equal((await backend.execute([{type:'resume',bus:'music',id:'theme'}]))[0].reason,'no-music');
});
test('disposal during pending playback prevents queued commands from starting',async()=>{
 let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const elements=[];
 const backend=create(()=>{
   const e={src:'',volume:1,loop:false,currentTime:0,
     play(){return gate;},pause(){},load(){},
     removeAttribute(){this.src='';}};
   elements.push(e);return e;
 });
 const first=backend.execute([music()]);
 const second=backend.execute([sfx()]);
 await Promise.resolve();await Promise.resolve();
 backend.dispose();
 release();
 await first;
 assert.deepEqual(await second,[{ok:false,reason:'destroyed'}]);
 assert.equal(elements.length,1);
 assert.equal(backend.status().music,null);
});

test('explicit audio voice limits fail closed instead of silently falling back to eight',async()=>{
 for(const invalid of [0,-1,1.5,33,NaN,Infinity,'2',null])
   assert.throws(()=>rig({maxSfxVoices:invalid}),/Invalid audio maxSfxVoices/);
 const defaultRig=rig();
 assert.equal(defaultRig.backend.status().maxSfxVoices,8);
 const bounded=rig({maxSfxVoices:1});
 assert.equal(bounded.backend.status().maxSfxVoices,1);
 await bounded.backend.execute([sfx('first'),sfx('second')]);
 assert.equal(bounded.backend.status().activeSfx,1);
 assert.equal(bounded.elements[0].src,'');
});

test('queued audio batches snapshot commands against caller mutation',async()=>{
 let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const elements=[];
 const backend=create(()=>{
   const e={src:'',volume:1,loop:false,currentTime:0,
     play(){return elements.length===1?gate:Promise.resolve();},
     pause(){},load(){},removeAttribute(){this.src='';}};
   elements.push(e);return e;
 });
 const first=backend.execute([music()]);
 const queuedCommand=sfx('original');
 const queuedBatch=[queuedCommand];
 const second=backend.execute(queuedBatch);
 queuedCommand.id='redirected';
 queuedCommand.path='https://attacker.example/evil.mp3';
 queuedCommand.bus='music';
 queuedBatch[0]=music('replaced');
 await Promise.resolve();await Promise.resolve();
 assert.equal(elements.length,1);
 release();
 assert.deepEqual(await first,[{ok:true}]);
 assert.deepEqual(await second,[{ok:true}]);
 assert.equal(elements.length,2);
 assert.equal(elements[1].src,'audio/sfx/impact.wav');
 assert.equal(backend.status().music,'theme');
 assert.equal(backend.status().activeSfx,1);
 backend.dispose();
});


test('native media pause exception is reported without aborting subsequent audio commands',async()=>{
 const {backend,elements}=rig();
 assert.deepEqual(await backend.execute([music()]),[{ok:true}]);
 elements[0].pause=()=>{throw new Error('media backend unavailable');};
 const results=await backend.execute([
   {type:'pause',bus:'music',id:'theme'},
   {type:'gain',bus:'music',gain:20},
   {type:'stop',bus:'music',id:'theme'}
 ]);
 assert.equal(results.length,3);
 assert.equal(results[0].reason,'pause-threw');
 assert.match(results[0].message,/media backend unavailable/);
 assert.deepEqual(results.slice(1),[{ok:true},{ok:true}]);
 assert.equal(backend.status().music,null);
 assert.equal(elements[0].src,'');
 assert.deepEqual(await backend.execute([music('recovered')]),[{ok:true}]);
 backend.dispose();
});


test('native media volume setter failure is reported and later commands still execute',async()=>{
 const {backend,elements}=rig();
 assert.deepEqual(await backend.execute([music()]),[{ok:true}]);
 let currentVolume=elements[0].volume;
 Object.defineProperty(elements[0],'volume',{
   configurable:true,
   get(){return currentVolume;},
   set(){throw new Error('media volume backend unavailable');}
 });
 const results=await backend.execute([
   {type:'gain',bus:'music',gain:25},
   {type:'pause',bus:'music',id:'theme'},
   {type:'stop',bus:'music',id:'theme'}
 ]);
 assert.equal(results.length,3);
 assert.equal(results[0].reason,'gain-threw');
 assert.match(results[0].message,/media volume backend unavailable/);
 assert.deepEqual(results.slice(1),[{ok:true},{ok:true}]);
 assert.equal(currentVolume,.8);
 assert.equal(backend.status().music,null);
 assert.equal(elements[0].src,'');
 assert.deepEqual(await backend.execute([music('recovered')]),[{ok:true}]);
 backend.dispose();
});

test('one failing SFX volume setter cannot permanently poison serialized batches',async()=>{
 const {backend,elements}=rig();
 assert.deepEqual(await backend.execute([sfx('first'),sfx('second')]),[{ok:true},{ok:true}]);
 Object.defineProperty(elements[0],'volume',{
   configurable:true,
   set(){throw new Error('detached audio element');}
 });
 const failed=await backend.execute([{type:'gain',bus:'sfx',gain:40}]);
 assert.equal(failed[0].reason,'gain-threw');
 assert.deepEqual(await backend.execute([music()]),[{ok:true}]);
 assert.equal(backend.status().music,'theme');
 backend.dispose();
});


test('second playback volume write failure is isolated and does not publish a ghost track',async()=>{
 const elements=[];
 let created=0;
 const backend=create(()=>{
   const e={src:'',loop:false,currentTime:0,pauses:0,loads:0,
     play(){return Promise.resolve();},
     pause(){this.pauses++;},
     load(){this.loads++;},
     removeAttribute(name){if(name==='src')this.src='';}};
   // Capture the element's ordinal: the factory increments the global
   // creation counter before the adapter's second volume write happens.
   const ordinal=created++;
   let writes=0,volume=1;
   Object.defineProperty(e,'volume',{get(){return volume;},set(value){
     writes++;
     if(ordinal===0&&writes===2)throw new Error('native second volume write failed');
     volume=value;
   }});
   elements.push(e);
   return e;
 });
 const result=await backend.execute([music(),sfx('after-failure')]);
 assert.equal(result.length,2);
 assert.equal(result[0].reason,'gain-threw');
 assert.match(result[0].message,/second volume write failed/);
 assert.deepEqual(result[1],{ok:true});
 assert.equal(backend.status().music,null);
 assert.equal(backend.status().activeSfx,1);
 assert.equal(elements[0].src,'');
 assert.ok(elements[0].loads>0);
 assert.equal(elements[1].src,'audio/sfx/impact.wav');
 assert.deepEqual(await backend.execute([music('recovered')]),[{ok:true}]);
 backend.dispose();
});
