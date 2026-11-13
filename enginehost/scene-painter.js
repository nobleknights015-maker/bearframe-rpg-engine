/* Read-only canvas paint deduplication for immutable offline atlas frames.
 * The canonical world/session still composes every deterministic presentation
 * tick; only an identical pixel packet may skip the expensive Canvas draw.
 * Atlas replacement, canvas resize, failures and explicit recovery invalidate.
 */
function createBearframeScenePainter(canvas,renderer){
  if(!canvas||typeof canvas.getContext!=='function')
    throw new TypeError('Canvas required for scene painter');
  var draw=renderer||(typeof module!=='undefined'&&module.exports?
    require('../framework/canvas.js'):drawBearframeSceneCanvas);
  if(typeof draw!=='function')throw new TypeError('Canvas renderer required');
  var last=null,paints=0,skips=0,invalidations=0,failures=0;
  var own=Object.prototype.hasOwnProperty;
  function frameEqual(a,b){
    return !!a&&!!b&&a.x===b.x&&a.y===b.y&&a.w===b.w&&a.h===b.h;
  }
  function imageInfo(image){
    return {ref:image,src:image.src,complete:image.complete,
      width:image.width,height:image.height,
      naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight};
  }
  function matches(scene,atlases){
    if(!last||!scene||!Array.isArray(scene.commands)||
       scene.width!==last.width||scene.height!==last.height||
       canvas.width!==last.canvasWidth||canvas.height!==last.canvasHeight||
       scene.commands.length!==last.commands.length||!atlases)
      return false;
    for(var i=0;i<scene.commands.length;i++){
      var c=scene.commands[i],old=last.commands[i];
      if(!c||c.type!==old.type)return false;
      if(c.type==='clear'){
        if(c.color!==old.color)return false;
      }else if(c.type==='sprite'){
        if(c.imageId!==old.imageId||
           !frameEqual(c.source,old.source)||
           !frameEqual(c.dest,old.dest)||
           !own.call(atlases,c.imageId))return false;
        var image=atlases[c.imageId],saved=last.images[c.imageId];
        if(!image||!saved||image!==saved.ref||
           image.complete===false||image.complete!==saved.complete||
           image.src!==saved.src||image.width!==saved.width||
           image.height!==saved.height||
           image.naturalWidth!==saved.naturalWidth||
           image.naturalHeight!==saved.naturalHeight)return false;
      }else return false;
    }
    return true;
  }
  function capture(scene,atlases){
    var images=Object.create(null);
    var commands=scene.commands.map(function(c){
      if(c.type==='clear')return {type:'clear',color:c.color};
      if(!own.call(images,c.imageId))images[c.imageId]=imageInfo(atlases[c.imageId]);
      return {type:'sprite',imageId:c.imageId,
        source:{x:c.source.x,y:c.source.y,w:c.source.w,h:c.source.h},
        dest:{x:c.dest.x,y:c.dest.y,w:c.dest.w,h:c.dest.h}};
    });
    return {width:scene.width,height:scene.height,
      canvasWidth:canvas.width,canvasHeight:canvas.height,
      commands:commands,images:images};
  }
  function invalidate(){last=null;invalidations++;}
  function paint(scene,atlases,force){
    if(!force&&matches(scene,atlases)){
      skips++;
      return {skipped:true,spritesDrawn:0,commandCount:scene.commands.length};
    }
    try{
      var result=draw(canvas,scene,atlases);
      last=capture(scene,atlases);
      paints++;
      return {skipped:false,spritesDrawn:result.spritesDrawn,
        commandCount:result.commandCount};
    }catch(error){
      failures++;invalidate();throw error;
    }
  }
  return Object.freeze({paint:paint,invalidate:invalidate,
    snapshot:function(){return {paints:paints,skipped:skips,
      invalidations:invalidations,failures:failures,
      skipRatio:paints+skips?skips/(paints+skips):0};}});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeScenePainter;
