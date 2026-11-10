const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('native WebView checks content bound save and safe refusal before/after process stop',()=>{
 const java=read('android/test/RouteRunner.java'),ci=read('.github/workflows/engine-ci.yml');
 assert.match(java,/checkUnifiedContentBinding\(boolean restart\)/);
 assert.match(java,/contentRevision='runtime_r1'/);
 assert.match(java,/changed\.items\.blade\.power=40/);
 assert.match(java,/incompatible-content/);
 assert.match(java,/first===BearframeNative\.read/);
 assert.match(ci,/stage unified-content-first/);
 assert.match(ci,/stage unified-content-second/);
 assert.match(ci,/am force-stop dev\.bearframe\.ridge/);
});
