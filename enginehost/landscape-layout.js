/* Engine v1-derived logical viewport drives the real Android landscape UI.
 * Visual scaling/diagnostic navigation MUST NOT write to a game journal. */
function createBearframeLandscapeLayout(stage,win){
  if(!stage||!stage.ownerDocument)throw new TypeError('Landscape stage required');
  var doc=stage.ownerDocument,view=win||doc.defaultView;
  if(!view||!view.addEventListener)throw new TypeError('Viewport window required');
  var create=(typeof module!=='undefined'&&module.exports)?
    require('../framework/viewport.js'):createBearframeViewport;
  // Engine v1 adaptive viewport: preserve a minimum logical 800x450
  // coordinate space, then expand the short/long logical axis to the usable
  // screen aspect. A fixed 16:9 box letterboxed the Founder's wide phone.
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
    var original=viewport.fit(width,height,insets||{}),safeArea=original.safeArea;
    var ratio=safeArea.width/safeArea.height;
    var lw=800,lh=450;
    if(ratio>800/450)lw=450*ratio;
    else if(ratio<800/450)lh=800/ratio;
    // Adapt the logical stage, not its child pixels: gameplay controls
    // remain correctly proportioned without stretching or scrolling.
    var adapted=create(lw,lh).fit(width,height,insets||{});
    return {width:adapted.cssWidth,height:adapted.cssHeight,scale:adapted.scale,
      offsetX:adapted.offsetX,offsetY:adapted.offsetY,
      stageWidth:lw,stageHeight:lh,safeArea:adapted.safeArea};
  }
  function apply(width,height,insets){
    var v=fit(width,height,insets);
    stage.style.width=v.stageWidth+'px';
    stage.style.height=v.stageHeight+'px';
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
    {view.visualViewport.addEventListener('resize',resize);
    // Browser chrome and keyboard can pan the visual viewport without a
    // resize. Keep the stage aligned with its actual visible origin.
    view.visualViewport.addEventListener('scroll',resize);}
  setDebug(false);
  return Object.freeze({fit:fit,resize:resize,setDebug:setDebug,
    snapshot:function(){return last?JSON.parse(JSON.stringify(last)):null;},
    isDebug:function(){return debug;}});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeLandscapeLayout;
