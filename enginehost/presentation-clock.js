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
  var active=false,handle=null,previous=null,tick=0,paints=0,failures=0;
  function stop(){
    var wasActive=active;
    active=false;previous=null;
    if(handle!==null){
      var pending=handle;
      handle=null;
      try{cancel(pending);}catch(error){
        failures++;
        if(typeof options.onError==='function')options.onError(error);
      }
    }
    return wasActive;
  }
  function frame(timestamp){
    handle=null;
    if(!active)return;
    if(!Number.isFinite(timestamp)){
      failures++;stop();
      if(typeof options.onError==='function')
        options.onError(new TypeError('Invalid animation timestamp'));
      return;
    }
    if(previous===null)previous=timestamp;
    else if(timestamp<previous)previous=timestamp;
    else if(timestamp-previous>=interval){
      var elapsed=Math.floor((timestamp-previous)/interval);
      previous+=elapsed*interval;
      // The portable scene's integer tick contract caps at 2^31-1.
      tick=(tick+elapsed)%2147483647;
      try{
        if(options.paint(tick)!==false)paints++;
      }catch(error){
        failures++;stop();
        if(typeof options.onError==='function')options.onError(error);
        return;
      }
    }
    if(active){
      try{handle=request(frame);}
      catch(error){
        failures++;stop();
        if(typeof options.onError==='function')options.onError(error);
      }
    }
  }
  function start(){
    if(active)return false;
    active=true;previous=null;
    try{handle=request(frame);}
    catch(error){active=false;previous=null;throw error;}
    return true;
  }
  return Object.freeze({
    start:start,stop:stop,
    tick:function(){return tick;},
    snapshot:function(){return {running:active,tick:tick,paints:paints,
      failures:failures,intervalMs:interval};}
  });
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframePresentationClock;
