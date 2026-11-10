const test=require('node:test'),assert=require('node:assert/strict');
const viewport=require('../framework/viewport'),performance=require('../framework/performance');
test('Engine v1 port fits 320x240 logical viewport to a phone without stretching',()=>{
  const v=viewport(320,240),fit=v.fit(393,830,{top:24,bottom:16,left:5,right:7});
  assert.equal(fit.screen.orientation,'portrait');
  assert.equal(fit.safeArea.x,5);assert.equal(fit.safeArea.width,381);
  assert.equal(fit.safeArea.height,790);
  assert.ok(fit.scale>0);
  const p=fit.logicalToScreen(100,50),back=fit.screenToLogical(p.x,p.y);
  assert.ok(Math.abs(back.x-100)<0.000001&&Math.abs(back.y-50)<0.000001);
  assert.equal(fit.screenToLogical(-999,-999).x,0);
  assert.equal(fit.screenToLogical(9999,9999).y,240);
});
test('Engine v1 port handles wide screens, cutouts and compact layouts',()=>{
  const v=viewport(1604,720);
  for(const [w,h] of [[1280,720],[1604,720],[1920,1080],[2400,1080],[2560,1600],[1600,2560]]){
    const layout=v.fit(w,h,{left:60,right:20,top:5,bottom:12});
    assert.ok(layout.scale>0);
    const a=layout.logicalToScreen(802,360),b=layout.screenToLogical(a.x,a.y);
    assert.ok(Math.abs(b.x-802)<0.000001&&Math.abs(b.y-360)<0.000001);
    const anchored=layout.anchor({width:360,height:180,anchorX:'right',anchorY:'bottom',margin:12});
    assert.ok(anchored.x>=layout.safeArea.x);
    assert.ok(anchored.y>=layout.safeArea.y);
    assert.ok(anchored.x+anchored.width<=layout.safeArea.x+layout.safeArea.width);
    assert.ok(anchored.y+anchored.height<=layout.safeArea.y+layout.safeArea.height);
  }
  assert.equal(v.classify(2400,1080).profile,'phone-ultrawide');
  assert.equal(v.classify(2560,1600).profile,'tablet-large');
});
test('Engine v1 port keeps rolling frame budget and reports warnings',()=>{
  const p=performance({profile:'balanced',windowSize:10});
  assert.equal(p.health().sampleCount,0);
  for(let i=0;i<10;i++)p.recordFrame(16);
  assert.equal(p.health().healthy,true);
  assert.equal(p.health().sampleCount,10);
  for(let i=0;i<10;i++)p.recordFrame(48);
  assert.equal(p.health().healthy,false);
  assert.equal(p.health().sampleCount,10);
  assert.ok(p.snapshot().longFrames>=10);
  assert.equal(p.assess({loadedAssets:150,visibleSprites:200,visibleTiles:5000}).level,'high');
  assert.ok(p.noteMemoryWarning().targetEntries<=64);
  assert.equal(p.snapshot().memoryWarnings,1);
});
test('Engine v1 port supports conservative devices and safe no-pressure recovery',()=>{
  const p=performance({profile:'conservative',windowSize:20});
  assert.equal(p.profile.targetFps,30);
  assert.equal(p.assess({loadedAssets:50,visibleSprites:30,visibleTiles:400}),null);
  assert.equal(p.assess({visibleTiles:1001}).level,'moderate');
  assert.equal(p.snapshot().pressure.reasons[0],'tile-count');
  assert.equal(p.assess({visibleTiles:0}),null);
  assert.equal(p.snapshot().pressure,null);
  assert.throws(()=>p.recordFrame(Infinity),/Invalid frame time/);
});
