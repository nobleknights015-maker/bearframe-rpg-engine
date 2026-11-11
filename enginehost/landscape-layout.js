/* Engine v1-derived logical viewport drives the real Android landscape UI.
 * Visual scaling/diagnostic navigation MUST NOT write to a game journal. */
function createBearframeLandscapeLayout(stage,win){
  if(!stage||!stage.ownerDocument)throw new TypeError('Landscape stage required');
  var doc=stage.ownerDocument,view=win||doc.defaultView;
  if(!view||!view.addEventListener)throw new TypeError('Viewport window required');
  var create=(typeof module!=='undefined'&&module.exports)?
    require('../framework/viewport.js'):createBearframeViewport;
  var viewport=create(800,450),last=null,debug=false;
  var probe=doc.createElement('div');probe.className='landscape-safe-area-probe';
  probe.setAttribute('aria-hidden','true');doc.body.appendChild(probe);
  function safe(){
    var style=view.getComputedStyle(probe);
    function pixel(n){return Math.max(0,parseFloat(n)||0);}
    return {top:pixel(style.paddingTop),right:pixel(style.paddingRight),
      bottom:pixel(style.paddingBottom),left:pixel(style.paddingLeft)};
  }
  function fit(width,height,insets){
    var v=viewport.fit(width,height,insets||{});
    return {width:v.cssWidth,height:v.cssHeight,scale:v.scale,
      offsetX:v.offsetX,offsetY:v.offsetY,stageWidth:800,stageHeight:450,
      safeArea:v.safeArea};
  }
  function apply(width,height,insets){
    var v=fit(width,height,insets);
    stage.style.transformOrigin='top left';
    stage.style.transform='translate('+v.offsetX+'px,'+v.offsetY+'px) scale('+v.scale+')';
    last=v;return v;
  }
  function resize(){
    var vv=view.visualViewport;
    var v=apply(vv?vv.width:view.innerWidth,vv?vv.height:view.innerHeight,safe());
    if(vv&&(vv.offsetLeft||vv.offsetTop))
      stage.style.transform='translate('+(v.offsetX+vv.offsetLeft)+'px,'+
        (v.offsetY+vv.offsetTop)+'px) scale('+v.scale+')';
    return v;
  }
  function setDebug(value){
    debug=!!value;
    doc.body.classList.toggle('landscape-gameplay',!debug);
    doc.body.classList.toggle('landscape-debug',debug);
    doc.documentElement.classList.toggle('landscape-gameplay',!debug);
    doc.documentElement.classList.toggle('landscape-debug',debug);
    if(!debug)resize();
    return debug;
  }
  var open=doc.getElementById('landscape-open-diagnostics');
  var close=doc.getElementById('landscape-close-diagnostics');
  if(open)open.addEventListener('click',function(){setDebug(true);});
  if(close)close.addEventListener('click',function(){setDebug(false);});
  view.addEventListener('resize',resize);
  if(view.visualViewport&&view.visualViewport.addEventListener)
    view.visualViewport.addEventListener('resize',resize);
  setDebug(false);
  return Object.freeze({fit:fit,resize:resize,setDebug:setDebug,
    snapshot:function(){return last?JSON.parse(JSON.stringify(last)):null;},
    isDebug:function(){return debug;}});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeLandscapeLayout;
