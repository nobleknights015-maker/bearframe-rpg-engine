/* Touch/pen/mouse directional pad for the installed WebView and browser.
 * Emits only the caller's canonical movement action; it never writes saves.
 * Pointer down moves once, an intentional hold repeats, and every lifecycle
 * interruption cancels the hold. Keyboard/screen-reader click still works.
 */
function createBearframeTouchPad(buttons,dispatch,win){
  if(!Array.isArray(buttons)||!buttons.length||typeof dispatch!=='function')
    throw new TypeError('Touch pad needs buttons and canonical dispatch');
  var doc=buttons[0].ownerDocument;
  if(!doc||typeof doc.addEventListener!=='function')
    throw new TypeError('Touch pad needs a document');
  win=win||doc.defaultView;
  if(!win||typeof win.addEventListener!=='function'||
     typeof win.setTimeout!=='function'||typeof win.clearTimeout!=='function')
    throw new TypeError('Touch pad needs a timer-capable window');
  var directions=['up','down','left','right'];
  var listeners=[],pointer=null,held=null,timer=null,disposed=false;
  var justPressed=null,lastPressTime=-Infinity;
  var firstDelay=270,repeatDelay=125;
  function listen(target,type,handler){
    target.addEventListener(type,handler);
    listeners.push([target,type,handler]);
  }
  function clearTimer(){
    if(timer!==null){win.clearTimeout(timer);timer=null;}
  }
  function stop(){
    clearTimer();pointer=null;held=null;
  }
  function activate(button){
    if(disposed||!button||button.disabled||doc.hidden)return false;
    var direction=button.getAttribute('data-party-world-dir')||
      button.getAttribute('data-dir');
    if(directions.indexOf(direction)<0)return false;
    var result=dispatch(direction);
    return result===true||result&&result.ok===true;
  }
  function repeat(){
    timer=null;
    if(pointer===null||!held||held.disabled||doc.hidden||disposed){stop();return;}
    if(!activate(held)){stop();return;}
    timer=win.setTimeout(repeat,repeatDelay);
  }
  buttons.forEach(function(button){
    if(!button||button.ownerDocument!==doc||
       typeof button.getAttribute!=='function'||
       directions.indexOf(button.getAttribute('data-party-world-dir')||
         button.getAttribute('data-dir'))<0)
      throw new TypeError('Touch pad button must have one valid direction');
    listen(button,'pointerdown',function(event){
      if(disposed||pointer!==null||button.disabled||doc.hidden||
         (typeof event.button==='number'&&event.button!==0)||
         !Number.isInteger(event.pointerId))return;
      pointer=event.pointerId;held=button;
      justPressed=button;lastPressTime=Date.now();
      if(typeof event.preventDefault==='function')event.preventDefault();
      // Capturing an actual pointer keeps release observable when the thumb
      // drifts away; synthetic instrumentation may not have active capture.
      if(typeof button.setPointerCapture==='function')
        try{button.setPointerCapture(pointer);}catch(error){}
      if(activate(button))timer=win.setTimeout(repeat,firstDelay);
      else stop();
    });
    listen(button,'click',function(event){
      // Android may synthesize a click after pointerup. Do not double-move.
      // detail=0 is keyboard, accessibility or programmatic activation.
      if(event&&event.detail>0&&justPressed===button&&
         Date.now()-lastPressTime<650){
        justPressed=null;
        if(typeof event.preventDefault==='function')event.preventDefault();
        return;
      }
      activate(button);
    });
    // A page may temporarily disable the pad when a scripted event starts.
    // Keep the finger's pending repeat from leaking into that new phase.
    listen(button,'lostpointercapture',function(event){
      if(pointer===event.pointerId)stop();
    });
  });
  function release(event){
    if(pointer===null||event.pointerId!==pointer)return;
    if(typeof event.preventDefault==='function')event.preventDefault();
    stop();
  }
  listen(doc,'pointerup',release);
  listen(doc,'pointercancel',release);
  listen(doc,'visibilitychange',function(){if(doc.hidden)stop();});
  listen(win,'blur',stop);
  listen(win,'pagehide',stop);
  return Object.freeze({
    cancel:stop,
    dispose:function(){
      if(disposed)return;
      disposed=true;stop();
      listeners.forEach(function(x){
        if(typeof x[0].removeEventListener==='function')
          x[0].removeEventListener(x[1],x[2]);
      });
      listeners=[];
    },
    isHeld:function(){return pointer!==null;}
  });
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeTouchPad;
