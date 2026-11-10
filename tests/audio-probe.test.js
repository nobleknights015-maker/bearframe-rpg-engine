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

test('background suspension stops active audio and requires a new user gesture',async()=>{
 const elements=[];
 const probe=makeProbe(()=>{const e={src:'',playCount:0,pauseCount:0,
   play(){this.playCount++;return Promise.resolve();},
   pause(){this.pauseCount++;},removeAttribute(){this.src='';},load(){}};
   elements.push(e);return e;});
 assert.equal((await probe.play()).ok,true);
 assert.equal(elements[0].playCount,1);
 probe.suspend();
 probe.suspend();
 assert.equal(probe.status().suspended,true);
 assert.equal(elements[0].src,'');
 assert.equal(elements[0].pauseCount,1);
 assert.equal((await probe.play()).reason,'suspended');
 assert.equal(elements.length,1);
 probe.resume();
 probe.resume();
 assert.equal(probe.status().suspended,false);
 assert.equal(elements.length,1,'foreground must not autoplay');
 assert.equal((await probe.play()).ok,true);
 assert.equal(elements.length,2,'a new gesture creates a fresh media element');
 probe.dispose();
 assert.equal(elements[1].src,'');
 assert.equal(probe.status().disposed,true);
 probe.resume();
 assert.equal((await probe.play()).reason,'disposed');
});
test('suspending while media playback is pending prevents stale active sound',async()=>{
 let resolvePlay;
 const elements=[];
 const probe=makeProbe(()=>{const e={src:'',pauseCount:0,
   play(){return new Promise(resolve=>{resolvePlay=resolve;});},
   pause(){this.pauseCount++;},removeAttribute(){this.src='';},load(){}};
   elements.push(e);return e;});
 const pending=probe.play();
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 probe.suspend();
 assert.equal(probe.status().activeSfx,0);
 assert.equal(elements[0].src,'');
 resolvePlay();
 await pending;
 assert.equal(probe.status().activeSfx,0);
 probe.resume();
 assert.equal(probe.status().activeSfx,0);
 probe.dispose();
});
test('native and browser visibility lifecycle routes both suspend and resume',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const boot=fs.readFileSync(path.join(__dirname,'../enginehost/boot.js'),'utf8');
 const native=fs.readFileSync(path.join(__dirname,
   '../android/src/dev/bearframe/ridge/UnifiedEngineActivity.java'),'utf8');
 assert.match(boot,/visibilitychange/);
 assert.match(boot,/audioProbe\.suspend\(\)/);
 assert.match(boot,/audioProbe\.resume\(\)/);
 assert.match(native,/browser\.onPause\(\)/);
 assert.match(native,/browser\.onResume\(\)/);
 assert.match(native,/BearframeHost&&window\.BearframeHost\.suspend\(\)/);
 assert.match(native,/BearframeHost&&window\.BearframeHost\.resume\(\)/);
});

test('installed Android WebView checks real packaged WAV metadata decoding',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const runner=fs.readFileSync(path.join(__dirname,'../android/test/RouteRunner.java'),'utf8');
 const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/engine-ci.yml'),'utf8');
 assert.match(runner,/checkUnifiedAudioDecode\(\)/);
 assert.match(runner,/a\\.onloadedmetadata=function\\(\\)/);
 assert.match(runner,/a\\.onloadeddata=function\\(\\)/);
 assert.match(runner,/a\\.readyState>=a\\.HAVE_CURRENT_DATA/);
 assert.match(runner,/a\\.buffered\\.length>0/);
 assert.match(runner,/a\\.buffered\\.end\\(0\\)>0/);
 assert.match(runner,/no-decoded-data/);
 assert.match(runner,/a\.duration>0&&isFinite\(a\.duration\)/);
 assert.match(runner,/a\.onerror=function\(\)/);
 assert.match(runner,/stage\.equals\("unified-audio"\)/);
 assert.match(runner,/PASS unified-audio/);
 assert.match(workflow,/stage unified-audio/);
 assert.match(workflow,/route=PASS unified-audio/);
 assert.match(workflow,/INSTRUMENTATION_CODE: -1/);
});
