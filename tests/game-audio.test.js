'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const install=require('../scripts/install_game_audio_profile');
const create=require('../enginehost/game-audio');
const profile={
  version:1,
  catalog:{
    hub_theme:{type:'music',path:'audio/music/hub.ogg',loop:true},
    field_theme:{type:'music',path:'audio/music/field.ogg',loop:true},
    battle_theme:{type:'music',path:'audio/music/battle.ogg',loop:true},
    menu_open:{type:'sfx',path:'audio/ui/open.wav'},
    door:{type:'sfx',path:'audio/world/door.wav'},
    hit:{type:'sfx',path:'audio/battle/hit.wav'}
  },
  cues:{menu_open:'menu_open',door:'door',battle_round:'hit'},
  music:{default:'hub_theme',battle:'battle_theme',
    maps:{hub:'hub_theme',field:'field_theme'}}
};
const world={maps:{hub:{},field:{}}};
function fakeAudio(){
 const events=[],elements=[];
 function make(){
   const el={src:'',loop:false,volume:1,preload:'',
     currentTime:0,play(){events.push('play:'+this.src);return Promise.resolve();},
     pause(){events.push('pause:'+this.src);},
     removeAttribute(k){if(k==='src')this.src='';},
     load(){},onended:null};
   elements.push(el);return el;
 }
 return {events,elements,make};
}
function tick(){return new Promise(resolve=>setImmediate(resolve));}
test('game audio never autoplays on start, save recovery, scene change or first rendering',async()=>{
 const media=fakeAudio(),audio=create(profile,media.make,{project:world});
 audio.scene(null,{map:'hub',sequence:0},null);
 audio.scene({map:'hub',sequence:0},{map:'field',sequence:1},'move');
 assert.equal(audio.status().available,true);
 assert.equal(audio.status().enabled,false);
 assert.equal(media.events.length,0);
 assert.deepEqual(await audio.enable(),{ok:true});
 assert.equal(audio.status().enabled,true);
 assert.deepEqual(media.events.filter(x=>x.startsWith('play:')),
   ['play:audio/music/field.ogg']);
 audio.dispose();
});
test('audio is gated by user gesture/focus and never plays after failed focus request',async()=>{
 const media=fakeAudio();let calls=0;
 const audio=create(profile,media.make,{project:world,
   requestFocus:()=>{calls++;return false;}});
 audio.scene(null,{map:'hub',sequence:1});
 assert.deepEqual(await audio.enable(),
   {ok:false,reason:'audio-focus-unavailable'});
 assert.equal(calls,1);
 assert.equal(media.events.length,0);
 assert.equal(audio.status().enabled,false);
 audio.dispose();
});
test('area transitions, menu cues and battle rounds route validated soundtrack/FX',async()=>{
 const media=fakeAudio(),audio=create(profile,media.make,{project:world});
 audio.scene(null,{map:'hub',sequence:0});
 await audio.enable();
 audio.signal('menu_open');await tick();
 audio.scene({map:'hub',sequence:0},{map:'field',sequence:1},'move');
 await tick();
 audio.scene({map:'field',sequence:1},
   {map:'field',sequence:2,partyBattle:{active:true}},'party-round');
 await tick();
 audio.scene({map:'field',sequence:2,partyBattle:{active:true}},
   {map:'field',sequence:3,partyBattle:{active:true}},'party-round');
 await tick();
 audio.scene({map:'field',sequence:3,partyBattle:{active:true}},
   {map:'field',sequence:4},'party-round');
 await tick();
 const plays=media.events.filter(x=>x.startsWith('play:'));
 assert.ok(plays.includes('play:audio/music/hub.ogg'));
 assert.ok(plays.includes('play:audio/music/field.ogg'));
 assert.ok(plays.includes('play:audio/music/battle.ogg'));
 assert.ok(plays.includes('play:audio/world/door.wav'));
 assert.ok(plays.includes('play:audio/ui/open.wav'));
 assert.ok(plays.includes('play:audio/battle/hit.wav'));
 audio.dispose();
});
test('mute and bus volumes do not modify external game state',async()=>{
 const media=fakeAudio(),worldState={sequence:40,map:'hub',inventory:{blade:1}};
 const before=JSON.stringify(worldState),audio=create(profile,media.make,{project:world});
 audio.scene(null,worldState);await audio.enable();
 assert.equal((await audio.volume('music',30)).ok,true);
 assert.equal((await audio.volume('sfx',0)).ok,true);
 assert.equal((await audio.mute(true)).ok,true);
 assert.equal(audio.status().muted,true);
 assert.equal(audio.status().volumes.music,30);
 assert.equal(audio.status().volumes.sfx,0);
 assert.equal((await audio.volume('music',101)).ok,false);
 assert.equal((await audio.mute('yes')).ok,false);
 assert.equal(JSON.stringify(worldState),before);
 audio.dispose();
});
test('explicit audio disable preserves session-only mute and individual bus settings',async()=>{
  const media=fakeAudio(),audio=create(profile,media.make,{project:world});
  audio.scene(null,{map:'hub',sequence:1});
  await audio.enable();
  await audio.volume('master',60);
  await audio.volume('music',25);
  await audio.volume('sfx',55);
  await audio.mute(true);
  audio.disable();
  assert.equal(audio.status().enabled,false);
  assert.equal(audio.status().muted,true);
  assert.deepEqual(audio.status().volumes,{master:60,music:25,sfx:55});
  await audio.enable();
  assert.deepEqual(audio.status().volumes,{master:60,music:25,sfx:55});
  assert.equal(audio.status().muted,true);
  audio.dispose();
});
test('background and resume never autoplay; new explicit enable can restore local music',async()=>{
 const media=fakeAudio();let releases=0,focus=0;
 const audio=create(profile,media.make,{project:world,
   requestFocus:()=>{focus++;return true;},
   releaseFocus:()=>{releases++;}});
 audio.scene(null,{map:'hub',sequence:0});
 await audio.enable();
 const initial=media.events.filter(x=>x.startsWith('play:')).length;
 audio.suspend();
 audio.resume();
 audio.scene({map:'hub',sequence:0},{map:'field',sequence:1},'move');
 await tick();
 assert.equal(media.events.filter(x=>x.startsWith('play:')).length,initial);
 assert.equal(audio.status().enabled,false);
 assert.ok(releases>=1);
 await audio.enable();
 assert.equal(focus,2);
 assert.ok(media.events.filter(x=>x.startsWith('play:')).length>initial);
 audio.dispose();
});
test('failed browser playback disables game audio and releases Android focus',async()=>{
 let releases=0;
 const factory=()=>({
   play(){return Promise.reject(new Error('autoplay denied'));},
   pause(){},load(){},removeAttribute(){},src:'',volume:1,currentTime:0});
 const audio=create(profile,factory,{project:world,releaseFocus:()=>{releases++;}});
 audio.scene(null,{map:'hub',sequence:0});
 const result=await audio.enable();
 assert.equal(result.ok,false);
 assert.equal(result.reason,'play-rejected');
 assert.equal(audio.status().enabled,false);
 assert.equal(audio.status().error,'play-rejected');
 assert.equal(releases,1);
 audio.dispose();
});
test('invalid or external clip references cannot enter audio session',()=>{
 const media=fakeAudio();
 for(const bad of [
   {...profile,cues:{menu_open:'battle_theme'}},
   {...profile,music:{...profile.music,maps:{unknown:'hub_theme'}}},
   {...profile,cues:{evil:'menu_open'}},
   {...profile,catalog:{bad:{type:'music',path:'https://remote.test/payload.mp3'}}}
 ])assert.throws(()=>create(bad,media.make,{project:world}));
 const missing=create(null,media.make,{project:world});
 assert.equal(missing.status().available,false);
 return missing.enable().then(result=>{
   assert.equal(result.reason,'no-soundtrack-packaged');
   assert.equal(media.events.length,0);
 });
});
test('private soundbank installer verifies bytes, copies only declared audio and emits data profile',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'bf-audio-test-'));
 try{
   const src=path.join(tmp,'source'),dst=path.join(tmp,'apk');
   fs.mkdirSync(src,{recursive:true});fs.mkdirSync(dst,{recursive:true});
   const bytes=Buffer.alloc(128,0x42);
   for(const clip of Object.values(profile.catalog)){
     const p=path.join(src,clip.path);
     fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes);
   }
   const input=path.join(tmp,'audio.json');
   fs.writeFileSync(input,JSON.stringify(profile));
   const manifest=install(input,src,dst);
   assert.equal(manifest.files.length,6);
   assert.equal(manifest.files.every(x=>x.sha256.length===64),true);
   assert.ok(fs.readFileSync(path.join(dst,'audio-profile.js'),'utf8')
     .includes('BEARFRAME_GAME_AUDIO_PROFILE'));
   assert.deepEqual(fs.readFileSync(path.join(dst,'audio/world/door.wav')),bytes);
   assert.equal(fs.existsSync(path.join(dst,'audio/diagnostics/silence.wav')),false);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('packager rejects traversal, symlinked local media and missing files',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'bf-audio-reject-'));
 try{
   const src=path.join(tmp,'src');fs.mkdirSync(src);
   const input=path.join(tmp,'profile.json'),dst=path.join(tmp,'out');
   const invalid=JSON.parse(JSON.stringify(profile));
   invalid.catalog.hub_theme.path='audio/../secret.mp3';
   fs.writeFileSync(input,JSON.stringify(invalid));
   assert.throws(()=>install(input,src,dst),/Invalid sound catalog item/);
   invalid.catalog.hub_theme.path='audio/music/hub.ogg';
   fs.writeFileSync(input,JSON.stringify(invalid));
   assert.throws(()=>install(input,src,dst),/ENOENT/);
   fs.mkdirSync(path.join(src,'audio/music'),{recursive:true});
   fs.writeFileSync(path.join(tmp,'secret.ogg'),Buffer.alloc(128));
   fs.symlinkSync(path.join(tmp,'secret.ogg'),path.join(src,'audio/music/hub.ogg'));
   assert.throws(()=>install(input,src,dst),/Symlink/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('Android build and live menu wire playable soundbank only through validated option',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const html=read('enginehost/index.html'),build=read('android/build.sh');
 const boot=read('enginehost/boot.js'),menu=read('enginehost/jrpg-menu.js');
 assert.match(html,/src="audio-profile\.js"/);
 assert.match(html,/src="game-audio\.js"/);
 assert.match(build,/BF_GAME_AUDIO_PACK_DIR/);
 assert.match(build,/install_game_audio_profile\.js/);
 assert.match(boot,/createBearframeGameAudio\(/);
 assert.match(boot,/gameAudio\.scene\(before,partyWorld\.view\(\),'move'\)/);
 assert.match(boot,/gameAudio\.suspend\(\)/);
 assert.match(menu,/Enable game sound/);
 assert.match(menu,/\['master','Master'\]/);
 assert.match(menu,/deps\.audio\.volume\(bus,/);
 assert.match(menu,/deps\.audio\.enable\(\)/);
});
