/* Read-only, host-side animation clock. Presentation frames never dispatch
 * game actions, increment journal revisions, or touch persistent storage.
 * requestAnimationFrame owns scheduling; the screen host owns visibility.
 */
function createBearframePresentationClock(options){
  if(!options||typeof options.paint!=='function')
    throw new TypeError('Presentation paint callback required');
  var interval=options.intervalMs===undefined?50:options.intervalMs;
  if(!Number.isInteger(interval)||interval<16||interval>1000)
    throw new TypeError('Presentation interval must be 16..1000ms');
  var view=typeof window!=='undefined'?window:null;
  var request=options.requestFrame||
    (view&&view.requestAnimationFrame&&view.requestAnimationFrame.bind(view));
  var cancel=options.cancelFrame||
    (view&&view.cancelAnimationFrame&&view.cancelAnimationFrame.bind(view));
  if(typeof request!=='function'||typeof cancel!=='function')
    throw new TypeError('Animation frame scheduler required');
  var active=false,handle=null,previous=null,tick=0,paints=0,failures=0,generation=0;
  // RAF callback cadence is not compositor FPS. Keep a bounded recent sample
  // without allocating/sorting work on the hot callback path.
  var lastCallbackTime=null,callbackGaps=[],callbackLimit=120;
  function pacingSnapshot(){
    var n=callbackGaps.length;
    if(!n)return {sampleCount:0,averageCallbackMs:0,p95CallbackMs:0,
      maxCallbackMs:0,gapsOver33Ms:0,gapsOver50Ms:0,callbackRateHz:0};
    var sum=0,max=0,over33=0,over50=0;
    callbackGaps.forEach(function(gap){
      sum+=gap;max=Math.max(max,gap);
      if(gap>33.34)over33++;
      if(gap>50)over50++;
    });
    var sorted=callbackGaps.slice().sort(function(a,b){return a-b;});
    var mean=sum/n;
    return {sampleCount:n,averageCallbackMs:mean,
      p95CallbackMs:sorted[Math.min(n-1,Math.ceil(n*0.95)-1)],
      maxCallbackMs:max,gapsOver33Ms:over33,gapsOver50Ms:over50,
      callbackRateHz:mean>0?1000/mean:0};
  }
  function report(error){
    if(typeof options.onError==='function'){
      try{options.onError(error);}catch(ignored){
        // Diagnostics must not prevent shutdown or a subsequent restart.
      }
    }
  }
  function schedule(){
    var token=generation;
    var delivered=false;
    return request(function(timestamp){
      // A misbehaving scheduler must not dispatch one callback twice.
      if(delivered||token!==generation)return;
      delivered=true;
      frame(timestamp);
    });
  }
  function stop(){
    var wasActive=active;
    active=false;previous=null;lastCallbackTime=null;generation++;
    if(handle!==null){
      var pending=handle;
      handle=null;
      try{cancel(pending);}catch(error){
        failures++;
        report(error);
      }
    }
    return wasActive;
  }
  function frame(timestamp){
    var frameGeneration=generation;
    handle=null;
    if(!active)return;
    if(!Number.isFinite(timestamp)){
      failures++;stop();
      report(new TypeError('Invalid animation timestamp'));
      return;
    }
    // A pause/restart never fabricates a giant first interval. Negative or
    // duplicate timestamps do not enter the telemetry window. Tick behavior
    // below stays identical for saved simulation and deterministic audits.
    if(lastCallbackTime!==null&&timestamp>lastCallbackTime){
      var gap=timestamp-lastCallbackTime;
      if(Number.isFinite(gap)&&gap<=60000){
        callbackGaps.push(gap);
        if(callbackGaps.length>callbackLimit)callbackGaps.shift();
      }
    }
    lastCallbackTime=timestamp;
    if(previous===null)previous=timestamp;
    else if(timestamp<previous)previous=timestamp;
    else if(timestamp-previous>=interval){
      var elapsed=Math.floor((timestamp-previous)/interval);
      if(!Number.isSafeInteger(elapsed)){
        failures++;stop();
        report(new RangeError('Animation elapsed tick count exceeds safe integer range'));
        return;
      }
      previous+=elapsed*interval;
      // The portable scene's integer tick contract caps at 2^31-1.
      tick=(tick+(elapsed%2147483647))%2147483647;
      try{
        if(options.paint(tick)!==false)paints++;
      }catch(error){
        failures++;stop();
        report(error);
        return;
      }
    }
    if(active&&frameGeneration===generation){
      try{handle=schedule();}
      catch(error){
        failures++;stop();
        report(error);
      }
    }
  }
  function start(){
    if(active)return false;
    active=true;previous=null;lastCallbackTime=null;generation++;
    try{handle=schedule();}
    catch(error){active=false;previous=null;throw error;}
    return true;
  }
  return Object.freeze({
    start:start,stop:stop,
    tick:function(){return tick;},pacingSnapshot:pacingSnapshot,
    snapshot:function(){return {running:active,tick:tick,paints:paints,
      failures:failures,intervalMs:interval};}
  });
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframePresentationClock;
