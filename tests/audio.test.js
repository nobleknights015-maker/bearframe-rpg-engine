const test=require('node:test'),assert=require('node:assert/strict');
const create=require('../framework/audio');
const catalog={
 ridge:{type:'music',path:'audio/music/ridge.ogg',loop:true},
 interior:{type:'music',path:'audio/music/interior.ogg',loop:false},
 step:{type:'sfx',path:'audio/effects/step.wav'},
 impact:{type:'sfx',path:'audio/effects/impact.mp3'}
};
test('rejects malformed audio references and asset traversal',()=>{
 assert.throws(()=>create({evil:{type:'music',path:'../../secret.ogg'}}),/Invalid local audio path/);
 assert.throws(()=>create({evil:{type:'music',path:'https://example.com/m.ogg'}}),/Invalid local audio path/);
 assert.throws(()=>create({evil:{type:'sfx',path:'audio/sfx/m.ogg',loop:true}}),/cannot loop/);
 assert.throws(()=>create({evil:{type:'unknown',path:'audio/sfx/m.ogg'}}),/Invalid audio clip/);
});
test('music transitions stop old tracks and begin new tracks deterministically',()=>{
 const a=create(catalog),start=a.fresh(),first=a.apply(start,{type:'music',id:'ridge'});
 assert.equal(first.state.music,'ridge');
 assert.equal(first.state.musicStarted,true);
 assert.deepEqual(first.commands,[{type:'play',bus:'music',id:'ridge',path:'audio/music/ridge.ogg',loop:true,gain:80}]);
 const same=a.apply(first.state,{type:'music',id:'ridge'});
 assert.equal(same.state,first.state);assert.deepEqual(same.commands,[]);
 const next=a.apply(first.state,{type:'music',id:'interior'});
 assert.equal(next.commands[0].type,'stop');
 assert.equal(next.commands[1].type,'play');
 assert.equal(next.commands[1].loop,false);
});
test('pause/resume and music replacement while paused maintain a coherent playback state',()=>{
 const a=create(catalog),playing=a.apply(a.fresh(),{type:'music',id:'ridge'}).state;
 const paused=a.apply(playing,{type:'pause'});
 assert.deepEqual(paused.commands,[{type:'pause',bus:'music',id:'ridge'}]);
 assert.equal(a.apply(paused.state,{type:'sfx',id:'step'}).commands.length,0);
 const changed=a.apply(paused.state,{type:'music',id:'interior'});
 assert.equal(changed.state.musicStarted,false);
 assert.equal(changed.commands[0].type,'stop');
 const resumed=a.apply(changed.state,{type:'resume'});
 assert.equal(resumed.commands[0].type,'play');
 assert.equal(resumed.state.musicStarted,true);
 assert.equal(resumed.state.paused,false);
 assert.equal(a.apply(resumed.state,{type:'resume'}).state,resumed.state);
});
test('volume and mute commands apply independently to music and sound effects',()=>{
 const a=create(catalog),start=a.fresh();
 const volume=a.apply(start,{type:'volume',bus:'master',value:50});
 assert.equal(volume.commands[0].gain,40);
 assert.equal(volume.commands[1].gain,50);
 const muted=a.apply(volume.state,{type:'mute'});
 assert.equal(muted.commands[0].gain,0);
 assert.deepEqual(a.apply(muted.state,{type:'sfx',id:'impact'}).commands,[]);
 const back=a.apply(muted.state,{type:'unmute'});
 assert.equal(back.commands[0].gain,40);
 assert.equal(back.commands[1].gain,50);
 const fx=a.apply(back.state,{type:'sfx',id:'step'});
 assert.equal(fx.commands[0].gain,50);
 assert.equal(fx.commands[0].loop,false);
});
test('invalid actions leave the audio state unchanged',()=>{
 const a=create(catalog),s=a.fresh();
 for(const cmd of [{type:'music',id:'missing'},{type:'sfx',id:'ridge'},
  {type:'volume',bus:'unknown',value:30},{type:'volume',bus:'music',value:-1},
  {type:'resume'},{type:'unmute'},{type:'stopMusic'},null]){
   const out=a.apply(s,cmd);assert.equal(out.state,s);
 }
 assert.equal(a.validateState({...s,volumes:{master:999,music:0,sfx:0}}),false);
});

test('catalog mutation cannot redirect playback or change validated clip semantics',()=>{
 const supplied={theme:{type:'music',path:'audio/music/theme.ogg',loop:true},
   tap:{type:'sfx',path:'audio/fx/tap.wav'}};
 const director=create(supplied);
 supplied.theme.path='https://attacker.example/track.mp3';
 supplied.theme.type='sfx';supplied.theme.loop=false;
 supplied.tap.path='../../outside.wav';supplied.tap.type='music';
 delete supplied.theme;delete supplied.tap;
 supplied.injected={type:'music',path:'audio/music/injected.ogg'};
 const start=director.fresh();
 assert.deepEqual(director.apply(start,{type:'music',id:'theme'}).commands,
  [{type:'play',bus:'music',id:'theme',path:'audio/music/theme.ogg',loop:true,gain:80}]);
 assert.deepEqual(director.apply(start,{type:'sfx',id:'tap'}).commands,
  [{type:'play',bus:'sfx',id:'tap',path:'audio/fx/tap.wav',loop:false,gain:100}]);
 assert.deepEqual(director.apply(start,{type:'music',id:'injected'}).commands,[]);
});

test('audio sequence remains an exact safe integer and fails closed on exhaustion',()=>{
 const director=create(catalog),initial=director.fresh();
 for(const sequence of [-1,1.5,Number.MAX_SAFE_INTEGER+1,Infinity,NaN]){
  assert.equal(director.validateState({...initial,sequence}),false);
  assert.throws(()=>director.apply({...initial,sequence},{type:'mute'}),/Invalid audio state/);
 }
 const near={...initial,sequence:Number.MAX_SAFE_INTEGER-1};
 const last=director.apply(near,{type:'mute'});
 assert.equal(last.state.sequence,Number.MAX_SAFE_INTEGER);
 assert.equal(last.state.muted,true);
 const unchanged=director.apply(last.state,{type:'mute'});
 assert.equal(unchanged.state,last.state);
 const fx=director.apply(last.state,{type:'sfx',id:'step'});
 assert.equal(fx.state,last.state);
 assert.deepEqual(fx.commands,[]);
 assert.throws(()=>director.apply(last.state,{type:'unmute'}),/Audio sequence exhausted/);
 assert.equal(last.state.muted,true);
 assert.equal(last.state.sequence,Number.MAX_SAFE_INTEGER);
});
