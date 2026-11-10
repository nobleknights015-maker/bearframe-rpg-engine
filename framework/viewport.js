/* Adapted from Chris's own Plushbound Legends Engine v1:
 * engine/src/platform/ScreenAdaptation.js and Canvas2DRenderBackend.js (LogicalViewport)
 * https://github.com/nobleknights015-maker/Plushbound-Legends-mobile/tree/engine-v1-rebuild/engine/src
 *
 * Bearframe port: no Plushbound world/assets, no DOM, portable Node + Android Rhino.
 */
function createBearframeViewport(logicalWidth, logicalHeight) {
  function positive(v,fallback){var n=Number(v);return isFinite(n)&&n>0?n:fallback;}
  function inset(v){var n=Number(v);return isFinite(n)&&n>0?n:0;}
  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  var lw=positive(logicalWidth,320),lh=positive(logicalHeight,240);
  function normalizeSafeInsets(v){
    v=v||{};
    return {top:inset(v.top),right:inset(v.right),bottom:inset(v.bottom),left:inset(v.left)};
  }
  function classify(width,height){
    var w=positive(width,lw),h=positive(height,lh);
    var long=Math.max(w,h),short=Math.min(w,h),aspect=long/short,profile='phone-standard';
    if(short>=900)profile='tablet-large';
    else if(short>=800)profile='tablet';
    else if(aspect>=2.15)profile='phone-ultrawide';
    else if(aspect>=1.85)profile='phone-wide';
    else if(aspect<1.55)profile='compact';
    return {profile:profile,aspect:aspect,width:w,height:h,orientation:w>=h?'landscape':'portrait'};
  }
  function fit(cssWidth,cssHeight,insets){
    var width=positive(cssWidth,lw),height=positive(cssHeight,lh),safe=normalizeSafeInsets(insets);
    var safeArea={x:safe.left,y:safe.top,
      width:Math.max(1,width-safe.left-safe.right),
      height:Math.max(1,height-safe.top-safe.bottom),
      insets:safe};
    var scale=Math.min(safeArea.width/lw,safeArea.height/lh);
    var ox=safeArea.x+(safeArea.width-lw*scale)/2;
    var oy=safeArea.y+(safeArea.height-lh*scale)/2;
    var screen=classify(width,height);
    function screenToLogical(x,y) {
      return {x:clamp((Number(x)-ox)/scale,0,lw),
        y:clamp((Number(y)-oy)/scale,0,lh)};
    }
    function logicalToScreen(x,y){
      return {x:ox+Number(x)*scale,y:oy+Number(y)*scale};
    }
    function anchor(spec){
      spec=spec||{};
      var m=inset(spec.margin),w=Math.max(0,Number(spec.width)||0),h=Math.max(0,Number(spec.height)||0);
      var px=Number(spec.x)||0,py=Number(spec.y)||0,x=safeArea.x+m+px,y=safeArea.y+m+py;
      if(spec.anchorX==='center')x=safeArea.x+safeArea.width/2-w/2+px;
      else if(spec.anchorX==='right')x=safeArea.x+safeArea.width-w-m-px;
      if(spec.anchorY==='center')y=safeArea.y+safeArea.height/2-h/2+py;
      else if(spec.anchorY==='bottom')y=safeArea.y+safeArea.height-h-m-py;
      return {x:Math.round(x),y:Math.round(y),width:w,height:h};
    }
    return {logicalWidth:lw,logicalHeight:lh,cssWidth:width,cssHeight:height,scale:scale,
      offsetX:ox,offsetY:oy,safeArea:safeArea,screen:screen,
      screenToLogical:screenToLogical,logicalToScreen:logicalToScreen,anchor:anchor};
  }
  return Object.freeze({fit:fit,classify:classify,normalizeSafeInsets:normalizeSafeInsets});
}
if(typeof module!=='undefined'&&module.exports)module.exports=createBearframeViewport;
