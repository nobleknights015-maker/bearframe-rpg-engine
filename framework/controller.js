/* Bearframe controller-neutral input. Inspired by the action mapping and
 * input edge concepts in the user's Plushbound Engine v1 InputManager.
 * Pure JS: used by WebView Gamepad API; native Android uses matching actions.
 * Standard mapping: left stick/D-pad navigate; South confirm; East cancel;
 * West menu; North map; LB/RB tabs; Select map; Start pause.
 */
function createBearframeControllerInput(config) {
  config=config||{};
  function rate(value,low,high,fallback) {
    return typeof value==='number'&&isFinite(value)&&value>=low&&value<=high?value:fallback;
  }
  var deadzone=rate(config.deadzone,0.25,0.90,0.48);
  var releaseZone=rate(config.releaseZone,0.10,deadzone-0.01,0.30);
  var delay=rate(config.repeatDelayMs,100,1000,260);
  var interval=rate(config.repeatIntervalMs,65,750,135);
  var held=null,nextAt=0,previous=[];
  var binds=[
    [0,'confirm'],[1,'cancel'],[2,'menu'],[3,'map'],
    [4,'previous-tab'],[5,'next-tab'],[8,'map'],[9,'pause']
  ];
  function button(raw,index){
    if(!raw||!raw.buttons||!raw.buttons[index])return false;
    var b=raw.buttons[index];
    return b===true||typeof b==='object'&&b!==null&&
      (b.pressed===true||typeof b.value==='number'&&b.value>=0.55);
  }
  function axis(raw,index){
    var n=raw&&raw.axes&&raw.axes[index];
    return typeof n==='number'&&isFinite(n)?Math.max(-1,Math.min(1,n)):0;
  }
  function clear(){held=null;nextAt=0;previous=[];}
  function direction(raw){
    // Standard Gamepad axes 0/1 and D-pad buttons 12-15.
    if(button(raw,12))return 'up';
    if(button(raw,13))return 'down';
    if(button(raw,14))return 'left';
    if(button(raw,15))return 'right';
    var x=axis(raw,0),y=axis(raw,1);
    var limit=held?releaseZone:deadzone;
    if(Math.abs(x)<limit&&Math.abs(y)<limit)return null;
    if(Math.abs(x)>Math.abs(y))return x>0?'right':'left';
    if(Math.abs(y)>Math.abs(x))return y>0?'down':'up';
    if(held==='up'||held==='down')return y>0?'down':'up';
    return x>0?'right':'left';
  }
  function poll(raw,nowMs){
    if(!raw||raw.connected===false){clear();return [];}
    if(typeof nowMs!=='number'||!isFinite(nowMs)||nowMs<0)
      throw new TypeError('Controller poll requires nonnegative monotonic milliseconds');
    var events=[];
    var dir=direction(raw);
    if(!dir){held=null;nextAt=0;}
    else if(dir!==held){
      held=dir;nextAt=nowMs+delay;
      events.push({type:'navigate',direction:dir});
    }else if(nowMs>=nextAt){
      nextAt=nowMs+interval;
      events.push({type:'navigate',direction:dir});
    }
    var next=[];
    binds.forEach(function(bind){
      var n=bind[0],was=previous[n]===true,is=button(raw,n);
      next[n]=is;
      if(is&&!was)events.push({type:bind[1]});
    });
    previous=next;
    return events;
  }
  function snapshot(){return {heldDirection:held,nextRepeatAt:nextAt};}
  return Object.freeze({poll:poll,clear:clear,snapshot:snapshot});
}
if(typeof module!=='undefined'&&module.exports)module.exports=createBearframeControllerInput;
