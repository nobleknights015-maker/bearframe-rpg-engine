/* Presentation-only movement interpolation.
 * Smooths the display between two *already committed* canonical positions.
 * It never emits gameplay commands, changes collision, or writes saves.
 */
function createBearframeMotionTween(durationMs){
  if(!Number.isInteger(durationMs)||durationMs<16||durationMs>250)
    throw new TypeError('Motion tween duration must be 16..250ms');
  var start=null,end=null,origin=0;
  function position(view){
    if(!view||typeof view.map!=='string'||!view.freePosition)return null;
    var p=view.freePosition;
    if(!p||typeof p.x!=='number'||typeof p.y!=='number'||
       !isFinite(p.x)||!isFinite(p.y))return null;
    return {map:view.map,x:p.x,y:p.y};
  }
  function reset(){start=null;end=null;origin=0;}
  function sample(now){
    if(!start||!end||!Number.isFinite(now))return null;
    var progress=Math.max(0,Math.min(1,(now-origin)/durationMs));
    return {x:start.x+(end.x-start.x)*progress,
      y:start.y+(end.y-start.y)*progress};
  }
  function capture(before,after,now){
    var previous=position(before),next=position(after);
    if(!previous||!next||previous.map!==next.map||
       !Number.isFinite(now)||now<0||
       Math.abs(next.x-previous.x)>1||
       Math.abs(next.y-previous.y)>1){
      reset();return false;
    }
    // New input may arrive before the previous tween finishes. Begin at the
    // currently displayed point, never snap backwards to the last tile center.
    var visible=sample(now);
    var point=visible&&start.map===previous.map?visible:previous;
    start={map:next.map,x:point.x,y:point.y};
    end=next;origin=now;
    return true;
  }
  return Object.freeze({reset:reset,capture:capture,sample:sample,
    active:function(now){return !!end&&Number.isFinite(now)&&now-origin<durationMs;}});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeMotionTween;
