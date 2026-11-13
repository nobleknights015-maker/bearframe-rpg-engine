'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const make=require('../enginehost/scene-painter');
const drawCanvas=require('../framework/canvas');
function scene(sx=0,dx=0){
 return {width:64,height:64,commands:[
  {type:'clear',color:'#111111'},
  {type:'sprite',imageId:'tiles',
   source:{x:sx,y:0,w:32,h:32},
   dest:{x:dx,y:0,w:32,h:32}}
 ]};
}
function image(){
 return {complete:true,src:'app://assets/floor.png',
  width:64,height:32,naturalWidth:64,naturalHeight:32};
}
function harness(){
 let calls=0;
 const canvas={width:64,height:64,getContext:()=>({})},tile=image();
 const draw=(element,packet,atlases)=>{
  assert.equal(element,canvas);
  assert.ok(atlases.tiles.complete);
  calls++;return {spritesDrawn:1,commandCount:packet.commands.length};
 };
 const painter=make(canvas,draw);
 return {canvas,tile,painter,calls:()=>calls};
}
test('identical immutable offline pixel packets skip Canvas draws, not simulation',()=>{
 const h=harness();
 assert.equal(h.painter.paint(scene(),{tiles:h.tile}).skipped,false);
 for(let i=0;i<8;i++){
  const result=h.painter.paint(scene(),{tiles:h.tile});
  assert.equal(result.skipped,true);
  assert.equal(result.commandCount,2);
 }
 assert.equal(h.calls(),1);
 assert.equal(h.painter.snapshot().paints,1);
 assert.equal(h.painter.snapshot().skipped,8);
 assert.equal(h.painter.snapshot().skipRatio,8/9);
 assert.ok(Number.isFinite(h.painter.snapshot().averageDrawMs));
 assert.ok(h.painter.snapshot().averageDrawMs>=0);
 assert.ok(h.painter.snapshot().maxDrawMs>=0);
 assert.ok(Number.isInteger(h.painter.snapshot().drawsOver16ms));
});
test('animated tile frames, camera shifts, canvas sizes and explicit audits repaint',()=>{
 const h=harness();
 h.painter.paint(scene(),{tiles:h.tile});
 assert.equal(h.painter.paint(scene(32),{tiles:h.tile}).skipped,false);
 assert.equal(h.painter.paint(scene(32,4),{tiles:h.tile}).skipped,false);
 h.canvas.width=128;
 assert.equal(h.painter.paint(scene(32,4),{tiles:h.tile}).skipped,false);
 assert.equal(h.painter.paint(scene(32,4),{tiles:h.tile},true).skipped,false);
 assert.equal(h.calls(),5);
});
test('mutable command objects cannot corrupt cached packet comparisons',()=>{
 const h=harness(),packet=scene();
 h.painter.paint(packet,{tiles:h.tile});
 packet.commands[1].dest.x=8;
 assert.equal(h.painter.paint(packet,{tiles:h.tile}).skipped,false);
 packet.commands[0].color='#222222';
 assert.equal(h.painter.paint(packet,{tiles:h.tile}).skipped,false);
 assert.equal(h.calls(),3);
});
test('asset replacement, decode readiness, image identity and trim invalidation repaint',()=>{
 const h=harness(),images={tiles:h.tile};
 h.painter.paint(scene(),images);
 images.tiles=image();
 assert.equal(h.painter.paint(scene(),images).skipped,false);
 images.tiles.src='app://assets/replaced-floor.png';
 assert.equal(h.painter.paint(scene(),images).skipped,false);
 images.tiles.width=128;
 assert.equal(h.painter.paint(scene(),images).skipped,false);
 images.tiles.complete=false;
 assert.throws(()=>h.painter.paint(scene(),images),{name:'AssertionError'},
  'incomplete images must be rejected, not painted or cached');
 images.tiles.complete=true;
 assert.equal(h.painter.paint(scene(),images).skipped,false);
 h.painter.invalidate();
 assert.equal(h.painter.paint(scene(),images).skipped,false);
 assert.equal(h.calls(),6); // The rejected incomplete atlas never reaches draw count.
 assert.equal(h.painter.snapshot().failures,1);
 assert.ok(h.painter.snapshot().invalidations>=2);
});
test('draw failure invalidates previous pixels and clean retry repaints',()=>{
 const canvas={width:64,height:64,getContext:()=>({})};
 const imageAtlas=image(),images={tiles:imageAtlas};let calls=0,fail=false;
 const painter=make(canvas,()=>{
  calls++;
  if(fail)throw Error('renderer context unavailable');
  return {spritesDrawn:1,commandCount:2};
 });
 painter.paint(scene(),images);
 fail=true;
 assert.throws(()=>painter.paint(scene(32),images),/renderer context unavailable/);
 fail=false;
 assert.equal(painter.paint(scene(),images).skipped,false);
 assert.equal(calls,3);
 assert.equal(painter.snapshot().failures,1);
});
test('real renderer preflight refuses missing or damaged image after a cached scene',()=>{
 let paints=0;
 const ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},
  fillRect(){},drawImage(){paints++;},imageSmoothingEnabled:true,fillStyle:''};
 const canvas={width:64,height:64,getContext:()=>ctx};
 const painter=make(canvas,drawCanvas),assets={tiles:image()};
 assert.equal(painter.paint(scene(),assets).skipped,false);
 assert.equal(paints,1);
 assert.equal(painter.paint(scene(),assets).skipped,true);
 delete assets.tiles;
 assert.throws(()=>painter.paint(scene(),assets),/Missing image atlas/);
 assets.tiles=image();
 assert.equal(painter.paint(scene(),assets).skipped,false);
 assert.equal(paints,2);
});
test('offline HTML and WebView host include live scene painter and recovery guard',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const html=read('enginehost/index.html'),boot=read('enginehost/boot.js');
 assert.match(html,/src="scene-painter\.js"/);
 assert.match(boot,/createBearframeScenePainter\(partyWorldSurface\)/);
 assert.match(boot,/partyWorldPainter\.paint\(frame,sceneImages\(\),!!deterministic\)/);
 assert.match(boot,/partyWorldPainter\.invalidate\(\)/);
 assert.match(boot,/scenePaint:partyWorldPainter\.snapshot\(\)/);
 assert.match(boot,/scenePainter:partyWorldPainter/);
 assert.match(boot,/addEventListener\('contextlost'/);
 assert.match(boot,/addEventListener\('contextrestored'/);
 assert.match(read('android/build.sh'),/enginehost\/\*\.js/);
});
