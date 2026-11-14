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
  assert.match(workflow,/BF_ENGINE_PREVIEW=1 BF_ENGINE_PREVIEW_BUILD_ID="\$preview_id"/);
  assert.match(workflow,/bearframe-engine-preview.apk/);
  assert.match(workflow,/BF_ENGINE_PREVIEW_BUILD_ID="\$preview_id"/);
  assert.match(workflow,/GITHUB_RUN_ATTEMPT/);
  assert.ok(!workflow.includes('GITHUB_SHA:0:8'), 'POSIX sh must never use Bash slicing');
  const ciLines=workflow.split(String.fromCharCode(10));
  const shaLines=ciLines.filter(line=>line.includes('preview_sha='));
  assert.equal(shaLines.length,2,'both CI shells must generate preview id');
  assert.ok(shaLines.every(line=>line.includes('cut -c1-8')),
    'use portable POSIX SHA prefix extraction');
  const emulatorPkg=ciLines.findIndex(line=>line.includes('preview_pkg='));
  assert.ok(emulatorPkg>0);
  assert.equal(ciLines[emulatorPkg].match(/^ */)[0].length,
    ciLines[emulatorPkg-1].match(/^ */)[0].length,
    'emulator preview code must stay inside the YAML script block');
  assert.match(workflow,/preview_pkg="dev\.bearframe\.ridge\.preview\.c\$\{preview_id\}"/);
  assert.match(workflow,/adb shell am start -W -n "\$\{preview_pkg\}\/dev\.bearframe\.ridge\.UnifiedEngineActivity"/);
  assert.doesNotMatch(workflow,/adb shell am force-stop dev\.bearframe\.ridge\.preview\s*$/m);
  assert.match(workflow,/adb install -r "\$RUNNER_TEMP\/bearframe-ci.apk"/);
});

test('unique per-run QA package preserves separately installed earlier preview identities',()=>{
  const work=fs.mkdtempSync(path.join(os.tmpdir(),'bf-preview-tag-'));
  try{
    const original=path.join(root,'android/AndroidManifest.xml');
    const src=fs.readFileSync(original,'utf8');
    const tag='0123abcda1b2c3d4';
    const tagged=path.join(work,'qa.xml');
    cp.execFileSync('python3',[
      path.join(root,'scripts/build_preview_manifest.py'),original,tagged,tag
    ]);
    const data=fs.readFileSync(tagged,'utf8');
    assert.match(data,/package="dev\.bearframe\.ridge\.preview\.c0123abcda1b2c3d4"/);
    assert.match(data,/android:label="Bearframe Engine QA 0123abcd"/);
    assert.match(data,/dev\.bearframe\.ridge\.UnifiedEngineActivity/);
    assert.match(data,/dev\.bearframe\.ridge\.ExpeditionActivity/);
    assert.match(data,/LAUNCHER/);
    assert.equal(fs.readFileSync(original,'utf8'),src);
    // Distinct CI runs may use separate throwaway signing keys without ever
    // overwriting each other's private app preferences or installed versions.
    const different=path.join(work,'qa2.xml');
    cp.execFileSync('python3',[
      path.join(root,'scripts/build_preview_manifest.py'),original,different,
      'deadbeefc1b2c3d4'
    ]);
    assert.notEqual(fs.readFileSync(different,'utf8').match(/package="([^"]+)"/)[1],
      data.match(/package="([^"]+)"/)[1]);
    const version2=path.join(work,'tag-version2.xml');
    cp.execFileSync('python3',[
      path.join(root,'scripts/build_versioned_manifest.py'),tagged,version2,'2'
    ]);
    assert.match(fs.readFileSync(version2,'utf8'),/android:versionCode="2"/);
    assert.match(fs.readFileSync(version2,'utf8'),
      /package="dev\.bearframe\.ridge\.preview\.c0123abcda1b2c3d4"/);
  }finally{fs.rmSync(work,{recursive:true,force:true});}
});
test('isolated preview tag refuses malformed identities without producing a manifest',()=>{
  const work=fs.mkdtempSync(path.join(os.tmpdir(),'bf-preview-bad-'));
  try{
    const source=path.join(root,'android/AndroidManifest.xml');
    for(const tag of ['', 'ABCDEF12', '1234567','000000000000000000000000000000000',
      'aaaaaaaa;rm','../main','deadbeef.foo','DEADBEEF']){
      const dest=path.join(work,'invalid-'+Buffer.from(tag).toString('hex')+'.xml');
      const result=cp.spawnSync('python3',[
        path.join(root,'scripts/build_preview_manifest.py'),source,dest,tag
      ],{encoding:'utf8',timeout:10000});
      assert.notEqual(result.status,0,'invalid tag accepted: '+JSON.stringify(tag));
      assert.equal(fs.existsSync(dest),false,'invalid manifest written: '+JSON.stringify(tag));
    }
  }finally{fs.rmSync(work,{recursive:true,force:true});}
});
