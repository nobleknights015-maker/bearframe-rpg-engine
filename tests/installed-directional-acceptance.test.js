'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('CI synthetic installed owner profile explicitly exercises four directions and walking frames',()=>{
  const yaml=read('.github/workflows/engine-ci.yml');
  const start=yaml.indexOf('Build a separate opt-in owner-profile APK');
  const block=yaml.slice(start,yaml.indexOf('Enable KVM for Android emulator',start));
  assert.match(block,/player:\{ticksPerFrame:2,directions:\{/);
  for(const dir of ['down','left','right','up'])
    assert.match(block,new RegExp(dir+':\\{idle:frame\\(\\d+\\),walk:\\[frame\\(\\d+\\),frame\\(\\d+\\)\\]\\}'));
  assert.match(block,/bash android\/build\.sh .*bearframe-owner-art-ci\.apk/);
});
test('Android installed engine must render two source frames, react to actual controller and preserve its v2 save',()=>{
  const java=read('android/test/RouteRunner.java');
  const start=java.indexOf('private void checkUnifiedOwnerArtProfile()');
  const end=java.indexOf('private void checkUnifiedAssetPack()',start);
  const block=java.slice(start,end);
  for(const symbol of [
    "pose('left',false,0)","pose('left',true,0)","pose('left',true,2)",
    "pose('up',false,0)","BearframeHost.input({type:'navigate',direction:'right'})",
    "cv.getContext('2d').getImageData","changed","host.verifySave().ok",
    'partyRevision','h.verifySave().ok','Owner art rehydration failed'
  ])assert.ok(block.includes(symbol),'Missing Android directional acceptance: '+symbol);
  assert.match(block,/movement\.getInt\("to"\)!=movement\.getInt\("from"\)\+1/);
  assert.match(block,/rehydrated\.getInt\("sequence"\)!=partyRevision/);
  assert.match(read('.github/workflows/engine-ci.yml'),/stage unified-owner-art/);
});
