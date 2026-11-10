/* Ported from Chris's Plushbound Engine v1 PerformanceBudget.js.
 * https://github.com/nobleknights015-maker/Plushbound-Legends-mobile/blob/engine-v1-rebuild/engine/src/platform/PerformanceBudget.js
 * Independent, no Plushbound game data, Node/browser/Android Rhino compatible.
 */
function createBearframePerformanceBudget(config) {
  config=config||{};
  var PROFILES={
    balanced:{targetFps:60,frameBudgetMs:16.67,maxFrameMs:33.34,maxLoadedAssets:128,maxVisibleSprites:96,maxVisibleTiles:1400},
    conservative:{targetFps:30,frameBudgetMs:33.34,maxFrameMs:50,maxLoadedAssets:96,maxVisibleSprites:64,maxVisibleTiles:1000}
  };
  var profileName=Object.prototype.hasOwnProperty.call(PROFILES,config.profile)?config.profile:'balanced';
  var p=PROFILES[profileName];
  var size=Math.max(10,Math.min(10000,Math.floor(Number(config.windowSize)||120)));
  var frames=[],longFrames=0,memoryWarnings=0,lastPressure=null;
  function health(){
    if(!frames.length)return {sampleCount:0,averageMs:0,p95Ms:0,fps:p.targetFps,overBudgetRatio:0,healthy:true};
    var sorted=frames.slice().sort(function(a,b){return a-b;});
    var sum=frames.reduce(function(a,b){return a+b;},0),avg=sum/frames.length;
    var p95=sorted[Math.min(sorted.length-1,Math.floor(sorted.length*0.95))];
    var over=frames.filter(function(ms){return ms>p.frameBudgetMs;}).length/frames.length;
    return {sampleCount:frames.length,averageMs:avg,p95Ms:p95,
      fps:avg>0?1000/avg:p.targetFps,overBudgetRatio:over,
      healthy:p95<=p.maxFrameMs&&over<=0.2};
  }
  function recordFrame(ms){
    var value=Math.max(0,Number(ms)||0);
    if(!isFinite(value))throw new TypeError('Invalid frame time');
    frames.push(value);
    if(frames.length>size)frames.shift();
    if(value>p.maxFrameMs)longFrames++;
    return health();
  }
  function assess(counters){
    counters=counters||{};
    var reasons=[];
    if((Number(counters.loadedAssets)||0)>p.maxLoadedAssets)reasons.push('asset-cache');
    if((Number(counters.visibleSprites)||0)>p.maxVisibleSprites)reasons.push('sprite-count');
    if((Number(counters.visibleTiles)||0)>p.maxVisibleTiles)reasons.push('tile-count');
    lastPressure=reasons.length?{level:reasons.length>1?'high':'moderate',reasons:reasons}:null;
    return lastPressure;
  }
  function noteMemoryWarning(){
    memoryWarnings++;
    return {action:'trim-assets',targetEntries:Math.max(24,Math.floor(p.maxLoadedAssets*0.5))};
  }
  function snapshot(){
    return {profile:profileName,longFrames:longFrames,memoryWarnings:memoryWarnings,
      pressure:lastPressure?JSON.parse(JSON.stringify(lastPressure)):null,health:health()};
  }
  return Object.freeze({profileName:profileName,profile:Object.freeze(Object.assign({},p)),
    recordFrame:recordFrame,assess:assess,noteMemoryWarning:noteMemoryWarning,
    health:health,snapshot:snapshot});
}
if(typeof module!=='undefined'&&module.exports)module.exports=createBearframePerformanceBudget;
