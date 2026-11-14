/* Explicit, read-only Android QA evidence for phone-only testers.
 * No save payload, character names, map IDs, inventory or game commands.
 * Samples DOM hit areas only on demand; never schedules a background loop.
 */
function createBearframeDeviceQA(options){
  if(!options||!options.stage||typeof options.snapshot!=='function'||
     typeof options.layout!=='function')
    throw new TypeError('Device QA requires stage, snapshot and layout');
  var stage=options.stage,doc=stage.ownerDocument;
  if(!doc||typeof stage.querySelectorAll!=='function')
    throw new TypeError('Device QA requires a document stage');
  var lastTouch=null;
  function num(v){
    return typeof v==='number'&&isFinite(v)?Math.round(v*100)/100:null;
  }
  function values(obj,keys){
    var result={};
    keys.forEach(function(key){
      var value=obj&&obj[key];
      if(typeof value==='number'&&isFinite(value))result[key]=num(value);
    });
    return result;
  }
  function visible(button){
    if(button.disabled)return false;
    for(var item=button;item;item=item.parentElement){
      if(item.hidden||typeof item.getAttribute==='function'&&
         (item.getAttribute('data-engine-page-hidden')!==null||
          item.getAttribute('aria-hidden')==='true'))return false;
      if(item===stage)break;
    }
    return typeof button.getClientRects==='function'&&
      button.getClientRects().length>0;
  }
  function describe(button,rect){
    var name=button.getAttribute('data-jrpg-command')||
      button.getAttribute('data-party-world-dir')||
      button.getAttribute('data-jrpg-page')||
      button.id||'button';
    if(!/^[a-zA-Z0-9:_-]{1,48}$/.test(name))name='button';
    return {control:name,widthCssPx:num(rect.width),heightCssPx:num(rect.height)};
  }
  function sample(){
    var undersized=[],undersizedCount=0,count=0,minW=null,minH=null;
    var buttons=stage.querySelectorAll('button');
    Array.prototype.forEach.call(buttons,function(button){
      if(!visible(button))return;
      var box=button.getBoundingClientRect();
      if(!box||!isFinite(box.width)||!isFinite(box.height)||
         box.width<=0||box.height<=0)return;
      count++;
      minW=minW===null?box.width:Math.min(minW,box.width);
      minH=minH===null?box.height:Math.min(minH,box.height);
      if(box.width<44||box.height<44){
        undersizedCount++;
        if(undersized.length<12)undersized.push(describe(button,box));
      }
    });
    lastTouch={minimumRecommendedCssPx:44,visibleControls:count,
      undersizedControls:undersizedCount,minimumWidthCssPx:num(minW),
      minimumHeightCssPx:num(minH),undersizedExamples:undersized};
    return lastTouch;
  }
  function capture(){
    var game=options.snapshot()||{},layout=options.layout()||{};
    var paint=game.scenePaint||{},work=game.renderWork||{},
      pacing=game.framePacing||{};
    var touch=lastTouch||sample();
    var nativeInfo={};
    if(options.nativeMetrics){
      try{
        var received=options.nativeMetrics();
        var parsed=typeof received==='string'?JSON.parse(received):received;
        if(parsed&&typeof parsed==='object'){
          nativeInfo=values(parsed,['apiLevel','hostProcessPssKb',
            'nativeHeapAllocatedBytes','javaHeapUsedBytes']);
          if(typeof parsed.model==='string')
            nativeInfo.model=parsed.model.slice(0,64);
        }
      }catch(ignored){nativeInfo={unavailable:true};}
    }
    return {kind:'bearframe-device-qa',version:1,
      collectedAt:new Date().toISOString(),
      // Engine scene-work time != delivered compositor frames per second.
      interpretation:'CPU scene/draw work; NOT measured display FPS',
      display:values(layout,['width','height','scale','stageWidth','stageHeight']),
      touch:JSON.parse(JSON.stringify(touch)),
      renderer:{
        paints:num(paint.paints),skips:num(paint.skipped),
        skipRatio:num(paint.skipRatio),
        averageDrawMs:num(paint.averageDrawMs),
        maxDrawMs:num(paint.maxDrawMs),
        drawsOver16ms:num(paint.drawsOver16ms)
      },
      renderWork:{
        sampleCount:num(work.health&&work.health.sampleCount),
        averageMs:num(work.health&&work.health.averageMs),
        p95Ms:num(work.health&&work.health.p95Ms),
        overBudgetRatio:num(work.health&&work.health.overBudgetRatio),
        longFrames:num(work.longFrames)
      },
      // Delivered RAF callback spacing, NOT compositor presentation FPS.
      callbackPacing:values(pacing,[
        'sampleCount','averageCallbackMs','p95CallbackMs','maxCallbackMs',
        'gapsOver33Ms','gapsOver50Ms','callbackRateHz'
      ]),
      loadedAssets:num(game.assetsLoaded),
      saveVerified:game.saveVerified===true,
      native:nativeInfo
    };
  }
  return Object.freeze({sample:sample,capture:capture});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeDeviceQA;
