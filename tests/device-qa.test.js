'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const make=require('../enginehost/device-qa');

function element(id,w,h,parent,attrs={}){
 return {id,parentElement:parent,hidden:false,disabled:false,
   getAttribute:k=>Object.prototype.hasOwnProperty.call(attrs,k)?attrs[k]:null,
   getClientRects:()=>w&&h?[{width:w,height:h}]:[],
   getBoundingClientRect:()=>({width:w,height:h})};
}
function harness(){
 const doc={},stage={ownerDocument:doc,hidden:false,parentElement:null,
  getAttribute:()=>null,querySelectorAll:()=>stage.buttons};
 const large=element('open-menu',80,49,stage),
       small=element('tiny-button',38,42,stage),
       hidden=element('invisible',10,10,stage,{'data-engine-page-hidden':''}),
       disabled=element('disabled',18,18,stage);
 disabled.disabled=true;
 stage.buttons=[large,small,hidden,disabled];
 const secrets='SENSITIVE SAVE CONTENT DO NOT LEAK';
 const qa=make({
   stage,
   snapshot:()=>({
     savedState:secrets,inventory:{password:secrets},map:'private-map',
     saveVerified:true,assetsLoaded:2944,
     scenePaint:{paints:25,skipped:11,skipRatio:11/36,
       averageDrawMs:1.25,maxDrawMs:3.7,drawsOver16ms:0},
     renderWork:{health:{sampleCount:12,averageMs:2.11,p95Ms:5.6,
       overBudgetRatio:0.08},longFrames:0}
   }),
   layout:()=>({width:900,height:420,scale:0.93,stageWidth:960,
     stageHeight:450,secret:secrets}),
   nativeMetrics:()=>JSON.stringify({
     apiLevel:35,model:'moto g - 2025',hostProcessPssKb:19123,
     nativeHeapAllocatedBytes:1234567,javaHeapUsedBytes:567890,
     deviceId:secrets,untrusted:secrets
   })
 });
 return {qa,stage,large,small,hidden,disabled,secrets};
}
test('samples actual visible button rectangles and excludes disabled/paginated-out controls',()=>{
 const h=harness(),touch=h.qa.sample();
 assert.deepEqual(touch,{minimumRecommendedCssPx:44,visibleControls:2,
   undersizedControls:1,minimumWidthCssPx:38,minimumHeightCssPx:42,
   undersizedExamples:[{control:'tiny-button',widthCssPx:38,heightCssPx:42}]});
 h.small.parentElement.hidden=true;
 assert.equal(h.qa.sample().visibleControls,1);
 assert.equal(h.qa.sample().undersizedControls,0);
 h.small.parentElement.hidden=false;
 h.small.hidden=true;
 assert.equal(h.qa.sample().visibleControls,1);
});
test('captures bounded release evidence and never serializes private gameplay or device identifiers',()=>{
 const h=harness();
 h.qa.sample();
 const report=h.qa.capture(),json=JSON.stringify(report);
 assert.equal(report.kind,'bearframe-device-qa');
 assert.equal(report.version,1);
 assert.equal(report.native.apiLevel,35);
 assert.equal(report.native.hostProcessPssKb,19123);
 assert.equal(report.native.model,'moto g - 2025');
 assert.deepEqual(report.display,{width:900,height:420,scale:.93,
   stageWidth:960,stageHeight:450});
 assert.equal(report.touch.visibleControls,2);
 assert.equal(report.renderWork.p95Ms,5.6);
 assert.equal(report.renderer.averageDrawMs,1.25);
 assert.equal(report.loadedAssets,2944);
 assert.equal(report.saveVerified,true);
 assert.match(report.interpretation,/NOT measured display FPS/);
 assert.doesNotMatch(json,/SENSITIVE SAVE CONTENT|private-map|password|deviceId/);
 assert.doesNotMatch(json,/"savedState"/);
});
test('snapshots are immutable across later samples and native bridge may be missing',()=>{
 const h=harness(),first=h.qa.capture();
 first.touch.undersizedExamples[0].control='mutated';
 const again=h.qa.capture();
 assert.equal(again.touch.undersizedExamples[0].control,'tiny-button');
 const noNative=make({stage:h.stage,snapshot:()=>({}),layout:()=>({}),
   nativeMetrics:()=>{throw new Error('no native bridge');}});
 assert.deepEqual(noNative.capture().native,{unavailable:true});
 assert.equal(noNative.capture().saveVerified,false);
});
test('physical QA stays in developer diagnostics, uses explicit native clipboard, preserves old saves',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const html=read('enginehost/index.html'),
       boot=read('enginehost/boot.js'),
       java=read('android/src/dev/bearframe/ridge/UnifiedEngineActivity.java'),
       native=read('android/src/dev/bearframe/ridge/DeviceQAClipboard.java'),
       testJava=read('android/test/RouteRunner.java');
 assert.match(html,/id="device-qa-copy"/);
 assert.match(html,/id="device-qa-report" readonly/);
 assert.match(html,/src="device-qa\.js"/);
 assert.match(boot,/createBearframeDeviceQA\(/);
 assert.match(boot,/deviceQA\.sample\(\);},true/);
 assert.match(boot,/deviceQaBridge\.copyReport\(report\)===true/);
 assert.match(boot,/deviceQA:deviceQA/);
 assert.match(java,/addJavascriptInterface\(deviceQAClipboard,"BearframeDeviceQAClipboard"\)/);
 assert.match(java,/removeJavascriptInterface\("BearframeDeviceQAClipboard"\)/);
 assert.match(native,/@JavascriptInterface public boolean copyReport\(String content\)/);
 assert.match(native,/ClipboardManager/);
 assert.doesNotMatch(native,/SharedPreferences|LegacyArchiveExport|ExpeditionActivity/);
 assert.match(testJava,/BearframeHost\.deviceQA\.capture\(\)/);
 assert.match(read('android/build.sh'),/android\/src\/dev\/bearframe\/ridge\/"\*\.java/);
});
