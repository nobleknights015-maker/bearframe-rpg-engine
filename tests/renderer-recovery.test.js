const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('native WebView renderer recovery does not touch saves, reloads restricted offline host and is bounded',()=>{
 const java=fs.readFileSync(path.join(__dirname,'../android/src/dev/bearframe/ridge/UnifiedEngineActivity.java'),'utf8');
 const runner=fs.readFileSync(path.join(__dirname,'../android/test/RouteRunner.java'),'utf8');
 const ci=fs.readFileSync(path.join(__dirname,'../.github/workflows/engine-ci.yml'),'utf8');
 assert.match(java,/onRenderProcessGone\(/);
 assert.match(java,/if\(view!=browser\)return false/);
 assert.match(java,/rendererRecoveries>2/);
 assert.match(java,/view\.destroy\(\)/);
 assert.match(java,/createOfflineBrowser\(\)/);
 assert.match(java,/getSharedPreferences\(PREFERENCES, MODE_PRIVATE\)/);
 assert.match(java,/Restart the app/);
 assert.match(runner,/checkUnifiedRendererRecovery\(\)/);
 assert.match(runner,/old\.getWebViewClient\(\)\.onRenderProcessGone\(old,null\)/);
 assert.match(runner,/fresh==old/);
 assert.match(runner,/restored\.getInt\("savedRevision"\)!=1/);
 assert.match(ci,/stage unified-renderer/);
});
