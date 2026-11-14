'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const tool=path.join(root,'scripts/build_versioned_manifest.py');
const source=path.join(root,'android/AndroidManifest.xml');
function temp(fn){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'bearframe-versioned-'));
 try{return fn(base);}finally{fs.rmSync(base,{recursive:true,force:true});}
}
function run(args){
 return cp.spawnSync('python3',[tool,...args],{encoding:'utf8',timeout:10000});
}
test('opt-in higher versionCode preserves the exact original launch identity and source manifest',()=>{
 temp(base=>{
  const raw=fs.readFileSync(source,'utf8');
  const upgraded=path.join(base,'version2.xml');
  const r=run([source,upgraded,'2']);
  assert.equal(r.status,0,r.stderr);
  const result=fs.readFileSync(upgraded,'utf8');
  assert.match(result,/package="dev.bearframe.ridge"/);
  assert.match(result,/android:versionCode="2"/);
  assert.match(result,/android:versionName="0.1.0"/);
  assert.match(result,/android:name=".ExpeditionActivity"/);
  assert.match(result,/android:name=".UnifiedEngineActivity"/);
  assert.match(result,/android:exported="false"/);
  assert.match(result,/LAUNCHER/);
  assert.equal(fs.readFileSync(source,'utf8'),raw,'source manifest was overwritten');
  assert.match(raw,/android:versionCode="1"/);
  assert.doesNotMatch(raw,/android:versionCode="2"/);
 });
});
test('preview package can be versioned separately without altering original identity or saved apps',()=>{
 temp(base=>{
  const preview=path.join(base,'preview.xml'),upgraded=path.join(base,'preview2.xml');
  const gen=cp.spawnSync('python3',[
   path.join(root,'scripts/build_preview_manifest.py'),source,preview
  ],{encoding:'utf8',timeout:10000});
  assert.equal(gen.status,0,gen.stderr);
  const r=run([preview,upgraded,'2']);
  assert.equal(r.status,0,r.stderr);
  const result=fs.readFileSync(upgraded,'utf8');
  assert.match(result,/package="dev.bearframe.ridge.preview"/);
  assert.match(result,/android:versionCode="2"/);
  assert.match(result,/dev.bearframe.ridge.UnifiedEngineActivity/);
  assert.match(fs.readFileSync(preview,'utf8'),/android:versionCode="1"/);
 });
});
test('invalid/ambiguous or non-increasing upgrade versions fail closed without outputs',()=>{
 temp(base=>{
  for(const value of ['','0','1','01','02','-2','2.0','+2','3 ', ' 3',
    '2;rm -rf /','9999999999','2100000001','2147483648','NaN','zero']){
   const dest=path.join(base,'rejected-'+Buffer.from(value).toString('hex')+'.xml');
   const r=run([source,dest,value]);
   assert.notEqual(r.status,0,'unexpectedly accepted '+JSON.stringify(value));
   assert.ok(!fs.existsSync(dest),'invalid input created manifest '+JSON.stringify(value));
  }
  const valid=path.join(base,'valid2.xml');
  assert.equal(run([source,valid,'2']).status,0);
  assert.notEqual(run([source,valid,'3']).status,0,'existing output cannot be overwritten');
  assert.notEqual(run([source,source,'3']).status,0,'in-place mutation forbidden');
  const packageChanged=path.join(base,'not-bearframe.xml');
  fs.writeFileSync(packageChanged,fs.readFileSync(source,'utf8')
    .replace('package="dev.bearframe.ridge"','package="com.other.app"'));
  const bad=path.join(base,'foreign.xml');
  assert.notEqual(run([packageChanged,bad,'3']).status,0);
  assert.equal(fs.existsSync(bad),false);
 });
});
test('Android CI signs two code versions with the same key and installs a real same-package upgrade',()=>{
 const read=p=>fs.readFileSync(path.join(root,p),'utf8');
 const build=read('android/build.sh'),ci=read('.github/workflows/engine-ci.yml');
 const route=read('android/test/RouteRunner.java');
 assert.match(build,/BF_ANDROID_VERSION_CODE/);
 assert.match(build,/scripts\/build_versioned_manifest.py/);
 assert.match(ci,/BF_ANDROID_VERSION_CODE=2 bash android\/build\.sh "\$RUNNER_TEMP\/bearframe-ci-upgrade\.apk"/);
 assert.match(ci,/versionCode='1'/);
 assert.match(ci,/versionCode='2'/);
 assert.match(ci,/test "\$original_cert" = "\$upgrade_cert"/);
 assert.match(ci,/adb install -r "\$RUNNER_TEMP\/bearframe-ci-upgrade\.apk"/);
 assert.match(ci,/BF_ANDROID_VERSION_CODE=3 bash android\/build\.sh "\$RUNNER_TEMP\/bearframe-owner-art-ci\.apk"/);
 assert.match(route,/Expected installed v2 signed upgrade/);
 assert.match(route,/original\.equals\(old\.getString\("expedition",null\)\)/);
 assert.match(route,/File continuation/);
 assert.match(route,/savedRevision/);
 assert.match(ci,/unified-compat-file-second/);
 assert.doesNotMatch(build,/uninstall|pm clear/);
});
