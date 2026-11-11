const test=require('node:test'),assert=require('node:assert/strict');
const validate=require('../framework/asset-manifest');
const create=require('../framework/asset-cache');
const manifest={
 version:1,
 assets:{
  terrain:{type:'atlas',path:'enginehost/assets/terrain.png',
    width:64,height:32,preload:true,pixelArt:true},
  actor:{type:'atlas',path:'enginehost/assets/actor.webp',
    width:64,height:48,preload:true,pixelArt:true},
  icon:{type:'image',path:'assets/system/icon.png',
    width:16,height:16,preload:false},
  theme:{type:'music',path:'assets/audio/theme.ogg',bytes:2000},
  confirm:{type:'sfx',path:'assets/audio/confirm.wav',bytes:1000}
 }
};
const clone=v=>JSON.parse(JSON.stringify(v));
const replace=fn=>{const m=clone(manifest);fn(m);return m;};
const fake=d=>({naturalWidth:d.width,naturalHeight:d.height,complete:true});
test('Engine v1 manifest port validates safe local asset IDs, dimensions, extensions and types',()=>{
 assert.equal(validate(manifest),manifest);
 assert.throws(()=>validate(replace(m=>m.assets.terrain.path='../private.png')),/Invalid asset descriptor/);
 assert.throws(()=>validate(replace(m=>m.assets.terrain.path='https://evil.example/img.png')),/Invalid asset descriptor/);
 assert.throws(()=>validate(replace(m=>m.assets.terrain.path='assets//bad.png')),/Invalid asset descriptor/);
 assert.throws(()=>validate(replace(m=>m.assets.terrain.path='assets/bad.svg')),/Invalid asset descriptor/);
 assert.throws(()=>validate(replace(m=>m.assets.actor.path=m.assets.terrain.path)),/Duplicate asset path/);
 assert.throws(()=>validate(replace(m=>{m.assets.actor.width=8192;m.assets.actor.height=8192;})),/Invalid image dimensions/);
 assert.throws(()=>validate(replace(m=>m.assets.actor.type='music')),/Incompatible asset type/);
 assert.throws(()=>validate(replace(m=>m.assets.actor.debug=true)),/Unknown asset metadata/);
 assert.throws(()=>validate(replace(m=>m.assets.theme.width=20)),/Audio asset/);
 assert.throws(()=>validate({version:5,assets:{}}),/version 1/);
});
test('Engine v1 asset LRU reuses cache and evicts oldest by entry count',async()=>{
 const calls=[];
 const assets=create(manifest,(d,id)=>{
   calls.push(id);return fake(d);
 },{maxEntries:2});
 const a=await assets.load('terrain');
 const b=await assets.load('actor');
 assert.strictEqual(await assets.load('terrain'),a);
 await assets.load('icon');
 assert.deepEqual(assets.snapshot().loaded,['terrain','icon']);
 assert.equal(assets.get('actor'),null);
 await assets.load('actor');
 assert.deepEqual(calls,['terrain','actor','icon','actor']);
 assert.equal(assets.release('terrain'),false);
 assert.equal(assets.release('icon'),true);
 assert.equal(assets.snapshot().loaded.length,1);
 assert.strictEqual(b.complete,true);
});
test('coalesces concurrent requests, rejects corrupt images and permits retry',async()=>{
 let calls=0,invalid=true;
 const cache=create(manifest,async d=>{
   calls++;
   if(invalid)return {naturalWidth:1,naturalHeight:1,complete:true};
   return fake(d);
 });
 const [first,second]=await Promise.allSettled([cache.load('terrain'),cache.load('terrain')]);
 assert.equal(first.status,'rejected');assert.equal(second.status,'rejected');
 assert.equal(calls,1);
 assert.deepEqual(cache.snapshot().inflight,[]);
 invalid=false;
 const asset=await cache.load('terrain');
 assert.equal(asset.naturalWidth,64);
 assert.equal(calls,2);
 assert.strictEqual(cache.get('terrain'),asset);
});
test('preloads only explicit preload assets and returns stable identifier map',async()=>{
 const loaded=[];
 const cache=create(manifest,async(d,id)=>{loaded.push(id);return fake(d);});
 const group=await cache.preload();
 assert.deepEqual(Object.keys(group),['terrain','actor']);
 assert.deepEqual(loaded,['terrain','actor']);
 assert.deepEqual(cache.snapshot().loaded,['terrain','actor']);
 const selected=await cache.preload(['actor','terrain','actor']);
 assert.strictEqual(selected.actor,group.actor);
 assert.equal(cache.snapshot().loaded.length,2);
 assert.throws(()=>cache.preload(['missing']),/Unknown asset/);
});
test('memory budgets reject oversized textures and evict older texture assets',async()=>{
 const costTerrain=64*32*4,costActor=64*48*4;
 const cache=create(manifest,async d=>fake(d),{
   maxMemoryBytes:costTerrain+costActor-1,maxEntries:5
 });
 await cache.load('terrain');
 await cache.load('actor');
 assert.deepEqual(cache.snapshot().loaded,['actor']);
 assert.equal(cache.snapshot().memoryBytes,costActor);
 const huge=replace(m=>{m.assets.large={type:'atlas',path:'assets/large.png',width:128,height:128};});
 const impossible=create(huge,async d=>fake(d),{maxMemoryBytes:16384});
 await assert.rejects(impossible.load('large'),/memory budget/);
});
test('clearing during an in-flight fetch prevents stale cache repopulation',async()=>{
 let finish;
 const cache=create(manifest,()=>new Promise(resolve=>{finish=resolve;}));
 const pending=cache.load('terrain');
 await Promise.resolve();
 cache.clear();
 finish(fake(manifest.assets.terrain));
 await pending;
 assert.deepEqual(cache.snapshot().loaded,[]);
 assert.deepEqual(cache.snapshot().inflight,[]);
});
test('mutating returned descriptors does not mutate manifest metadata',async()=>{
 const cache=create(manifest,async d=>fake(d));
 const desc=cache.descriptor('terrain');
 desc.width=1;desc.path='assets/bad.png';
 assert.equal(cache.descriptor('terrain').width,64);
 assert.equal(cache.descriptor('terrain').path,'enginehost/assets/terrain.png');
 const audio=await cache.load('theme');
 assert.equal(typeof audio,'object');
});

test('memory pressure trims least-recently-used textures without touching game state',async()=>{
 const cache=create(manifest,async d=>fake(d),{maxMemoryBytes:65536});
 await cache.load('terrain');
 await cache.load('actor');
 await cache.load('icon');
 assert.equal(cache.snapshot().memoryBytes,64*32*4+64*48*4+16*16*4);
 cache.get('terrain'); // actor becomes oldest
 const result=cache.trimTo(64*32*4+16*16*4);
 assert.deepEqual(result,{evicted:1,memoryBytes:64*32*4+16*16*4});
 assert.deepEqual(cache.snapshot().loaded,['icon','terrain']);
 assert.equal(cache.get('actor'),null);
 assert.equal(cache.get('terrain').naturalWidth,64);
 assert.throws(()=>cache.trimTo(-1),/Invalid asset cache target/);
 assert.throws(()=>cache.trimTo(65537),/Invalid asset cache target/);
 assert.throws(()=>cache.trimTo(1.5),/Invalid asset cache target/);
});
test('critical memory pressure cancels pending cache insertions',async()=>{
 let resolve;
 const cache=create(manifest,()=>new Promise(r=>{resolve=r;}));
 const pending=cache.load('terrain');
 await Promise.resolve();
 assert.equal(cache.trimTo(0).evicted,0);
 resolve(fake(manifest.assets.terrain));
 await pending;
 assert.deepEqual(cache.snapshot().loaded,[]);
 assert.equal(cache.snapshot().memoryBytes,0);
});

test('host low-memory callback blocks input until scene atlases reload, without altering saves',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const boot=fs.readFileSync(path.join(__dirname,'../enginehost/boot.js'),'utf8');
 const native=fs.readFileSync(path.join(__dirname,
  '../android/src/dev/bearframe/ridge/UnifiedEngineActivity.java'),'utf8');
 assert.match(native,/@Override public void onTrimMemory\(int level\)/);
 assert.match(native,/super\.onTrimMemory\(level\)/);
 assert.match(native,/browser\.evaluateJavascript\(/);
 assert.match(native,/BearframeHost\.memoryPressure/);
 assert.match(boot,/memoryPressure:memoryPressure/);
 assert.match(boot,/assets\.trimTo\(target\)/);
 assert.match(boot,/assets\.preload\(\['terrain','characters'\]\)/);
 assert.match(boot,/if\(restoring\|\|!assets\.get\('terrain'\)\|\|!assets\.get\('characters'\)\)/);
 assert.match(boot,/reason:'assets-restoring'/);
 assert.match(boot,/Scene restoration failed/);
});
test('critical trim and rehydration require a new decode and preserve prior values',async()=>{
 let requests=0;
 const cache=create(manifest,async d=>{requests++;return fake(d);});
 const first=await cache.preload(['terrain','actor']);
 assert.equal(requests,2);
 const before=cache.snapshot().memoryBytes;
 assert.ok(before>0);
 cache.trimTo(0);
 assert.equal(cache.get('terrain'),null);
 assert.equal(cache.get('actor'),null);
 const second=await cache.preload(['terrain','actor']);
 assert.equal(requests,4);
 assert.notStrictEqual(first.terrain,second.terrain);
 assert.equal(cache.snapshot().memoryBytes,before);
 assert.deepEqual(cache.snapshot().loaded,['terrain','actor']);
});

test('installed-app memory stage verifies native callback, reload telemetry and durable journal',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const runner=fs.readFileSync(path.join(__dirname,'../android/test/RouteRunner.java'),'utf8');
 const ci=fs.readFileSync(path.join(__dirname,'../.github/workflows/engine-ci.yml'),'utf8');
 const host=fs.readFileSync(path.join(__dirname,'../enginehost/boot.js'),'utf8');
 assert.match(runner,/checkUnifiedMemoryRecovery\(\)/);
 assert.match(runner,/screen\.onTrimMemory\(android\.content\.ComponentCallbacks2\.TRIM_MEMORY_COMPLETE\)/);
 assert.match(runner,/getInt\("trimCount"\)>0/);
 assert.match(runner,/getInt\("recoveryCount"\)>0/);
 assert.match(runner,/getInt\("savedRevision"\)!=saved/);
 assert.match(runner,/Restored canvas did not draw packaged pixels/);
 assert.match(ci,/stage unified-memory/);
 assert.match(ci,/route=PASS unified-memory/);
 assert.match(host,/trimCount\+\+/);
 assert.match(host,/recoveryCount\+\+/);
 assert.match(host,/recoveryFailures\+\+/);
 assert.match(host,/restoring:!!restoring/);
});


test('failed renderer asset recovery exposes explicit user retry without advancing saves',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const boot=fs.readFileSync(path.join(__dirname,'../enginehost/boot.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../enginehost/index.html'),'utf8');
 assert.match(html,/<button id="runtime-assets-retry" type="button" disabled hidden>/);
 assert.match(boot,/retryAssets\.addEventListener\('click',function\(\)\{[\s\S]*?memoryPressure\(80\)/);
 assert.match(boot,/Scene restoration failed:[\s\S]*?retryAssets\.disabled=false;retryAssets\.hidden=false/);
 assert.match(boot,/Asset loading failed:[\s\S]*?location\.reload\(\)/);
 assert.match(boot,/if\(restoring\|\|!assets\.get\('terrain'\)\|\|!assets\.get\('characters'\)\)/);
});
