const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),
  cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
test('engine preview manifest is explicitly isolated from production identity and launcher',()=>{
  const work=fs.mkdtempSync(path.join(os.tmpdir(),'bf-preview-'));
  try{
    const original=path.join(root,'android/AndroidManifest.xml');
    const preview=path.join(work,'preview.xml');
    const before=fs.readFileSync(original,'utf8');
    cp.execFileSync('python3',[path.join(root,'scripts/build_preview_manifest.py'),original,preview]);
    const after=fs.readFileSync(preview,'utf8');
    assert.match(after,/package="dev.bearframe.ridge.preview"/);
    assert.match(after,/Bearframe Engine Preview/);
    assert.match(after,/dev.bearframe.ridge.UnifiedEngineActivity/);
    assert.match(after,/dev.bearframe.ridge.ExpeditionActivity/);
    assert.match(after,/LAUNCHER/);
    assert.match(after,/android:exported="true"/);
    assert.match(after,/android:exported="false"/);
    assert.equal(fs.readFileSync(original,'utf8'),before,'source manifest changed');
    assert.match(before,/package="dev.bearframe.ridge"/);
    assert.doesNotMatch(before,/dev.bearframe.ridge.preview/);
  }finally {fs.rmSync(work,{recursive:true,force:true});}
});
test('CI builds and publishes separately installable engine test APK',()=>{
  const build=fs.readFileSync(path.join(root,'android/build.sh'),'utf8');
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/engine-ci.yml'),'utf8');
  assert.match(build,/BF_ENGINE_PREVIEW/);
  assert.match(build,/scripts\/build_preview_manifest.py/);
  assert.match(workflow,/BF_ENGINE_PREVIEW=1 bash android\/build.sh/);
  assert.match(workflow,/bearframe-engine-preview.apk/);
  assert.match(workflow,/dev.bearframe.ridge.preview\/dev.bearframe.ridge.UnifiedEngineActivity/);
  assert.match(workflow,/adb install -r "\$RUNNER_TEMP\/bearframe-ci.apk"/);
});
