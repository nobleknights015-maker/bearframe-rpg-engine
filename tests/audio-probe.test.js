const test=require('node:test');
const assert=require('node:assert/strict');
const makeWav=require('../scripts/generate_audio_fixture');
const makeProbe=require('../enginehost/audio-probe');
test('generated WAV has a valid deterministic RIFF/PCM header and silence',()=>{
 const a=makeWav(),b=makeWav();
 assert.deepEqual(a,b);
 assert.equal(a.length,4044);
 assert.equal(a.toString('ascii',0,4),'RIFF');
 assert.equal(a.readUInt32LE(4),a.length-8);
 assert.equal(a.toString('ascii',8,12),'WAVE');
 assert.equal(a.toString('ascii',12,16),'fmt ');
 assert.equal(a.readUInt16LE(20),1);
 assert.equal(a.readUInt16LE(22),1);
 assert.equal(a.readUInt32LE(24),8000);
 assert.equal(a.readUInt16LE(34),16);
 assert.equal(a.toString('ascii',36,40),'data');
 assert.equal(a.readUInt32LE(40),4000);
 assert.equal(a.subarray(44).every(x=>x===0),true);
});
test('host probe uses a local WAV with portable director and never autoplays',async()=>{
 const elements=[];
 const probe=makeProbe(()=>{
  const el={src:'',volume:1,loop:true,plays:0,pauses:0,
    play(){this.plays++;return Promise.resolve();},
    pause(){this.pauses++;},removeAttribute(){this.src='';},load(){}};
  elements.push(el);return el;
 });
 assert.equal(elements.length,0);
 assert.equal(probe.status().activeSfx,0);
 assert.deepEqual(await probe.play(),{ok:true});
 assert.equal(elements[0].src,'audio/diagnostics/silence.wav');
 assert.equal(elements[0].loop,false);
 assert.equal(elements[0].plays,1);
 probe.dispose();
 assert.equal(elements[0].src,'');
 assert.equal((await probe.play()).reason,'disposed');
 assert.equal(elements.length,1);
});
test('host audio probe surfaces browser playback failures',async()=>{
 const probe=makeProbe(()=>({
  play(){return Promise.reject(new Error('autoplay blocked'));},
  pause(){},removeAttribute(){},load(){}
 }));
 const result=await probe.play();
 assert.equal(result.ok,false);
 assert.equal(result.reason,'play-rejected');
 assert.equal(probe.status().activeSfx,0);
 probe.dispose();
});
test('offline host CSP restricts media to packaged same-origin files',()=>{
 const fs=require('node:fs');
 const html=fs.readFileSync(require('node:path').join(__dirname,'../enginehost/index.html'),'utf8');
 assert.match(html,/media-src 'self'/);
 assert.doesNotMatch(html,/media-src[^;]*https?:/);
 assert.match(html,/audio-probe\.js/);
 assert.match(html,/audio-browser\.js/);
});
test('Android build packages generated WAV at the host-relative location',()=>{
 const fs=require('node:fs');
 const build=fs.readFileSync(require('node:path').join(__dirname,'../android/build.sh'),'utf8');
 assert.match(build,/generate_audio_fixture\.js/);
 assert.match(build,/enginehost\/audio\/diagnostics\/silence\.wav/);
});

test('native WebView response CSP permits same-origin audio without remote media',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const java=fs.readFileSync(path.join(__dirname,
   '../android/src/dev/bearframe/ridge/UnifiedEngineActivity.java'),'utf8');
 const csp=java.match(/headers\.put\("Content-Security-Policy",([\s\S]*?)\);/);
 assert.ok(csp,'native HTTP response must include Content-Security-Policy');
 assert.match(csp[1],/media-src 'self'/);
 assert.match(csp[1],/connect-src 'none'/);
 assert.doesNotMatch(csp[1],/media-src[^;]*https?:/);
 assert.match(java,/if \(path\.endsWith\("\.wav"\)\) return "audio\/wav";/);
 assert.match(java,/if \(path\.endsWith\("\.ogg"\)\) return "audio\/ogg";/);
 assert.match(java,/if \(path\.endsWith\("\.mp3"\)\) return "audio\/mpeg";/);
});
