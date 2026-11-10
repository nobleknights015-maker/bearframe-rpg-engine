const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('installed WebView verifies the original synthetic custom-pack PNG pixels and journal isolation',()=>{
 const r=fs.readFileSync(path.join(__dirname,'../android/test/RouteRunner.java'),'utf8');
 const ci=fs.readFileSync(path.join(__dirname,'../.github/workflows/engine-ci.yml'),'utf8');
 assert.match(r,/checkUnifiedAssetPack\(\)/);
 assert.match(r,/enginehost\/packs\/active\/diagnostic\/test\.png/);
 assert.match(r,/img\.naturalWidth===64&&img\.naturalHeight===32/);
 assert.match(r,/rgba\[0\]===76&&rgba\[1\]===100&&rgba\[2\]===128&&rgba\[3\]===255/);
 assert.match(r,/before\.getInt\("savedRevision"\)!=after\.getInt\("savedRevision"\)/);
 assert.match(r,/stage\.equals\("unified-pack"\)/);
 assert.match(ci,/stage unified-pack dev\.bearframe\.ridge\.tests\/\.RouteRunner/);
 assert.match(ci,/route=PASS unified-pack/);
});
