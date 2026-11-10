/* Pixel-perfect browser Canvas adapter for the portable scene command format.
 * Images are supplied by the host. Atlas loading must finish before draw().
 */
function drawBearframeSceneCanvas(canvas,scene,atlases){
  if(!canvas||typeof canvas.getContext!=='function')
    throw new TypeError('Canvas with 2D context required');
  var ctx=canvas.getContext('2d');
  if(!ctx||typeof ctx.drawImage!=='function'||typeof ctx.fillRect!=='function')
    throw new TypeError('Canvas 2D graphics unavailable');
  if(!scene||!Number.isInteger(scene.width)||!Number.isInteger(scene.height)||
    scene.width<1||scene.height<1||!Array.isArray(scene.commands))
    throw new TypeError('Invalid scene command packet');
  if(!atlases||typeof atlases!=='object')throw new TypeError('Image atlas registry required');
  var own=Object.prototype.hasOwnProperty,drawn=0;
  function dimensions(image) {
    return {w:Number.isInteger(image.naturalWidth)?image.naturalWidth:image.width,
      h:Number.isInteger(image.naturalHeight)?image.naturalHeight:image.height};
  }
  function rect(r){return r&&['x','y','w','h'].every(function(k){
    return Number.isInteger(r[k])&&(k==='w'||k==='h'?r[k]>0:true);
  });}
  // Preflight the entire packet: never paint a partial scene on missing sprites.
  scene.commands.forEach(function(cmd,index){
    if(!cmd||typeof cmd!=='object')throw new TypeError('Invalid draw command '+index);
    if(cmd.type==='clear'){
      if(typeof cmd.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(cmd.color))
        throw new TypeError('Invalid clear color '+index);
    }else if(cmd.type==='sprite'){
      if(typeof cmd.imageId!=='string'||!own.call(atlases,cmd.imageId))
        throw new TypeError('Missing image atlas '+cmd.imageId);
      var image=atlases[cmd.imageId];
      if(!image||(typeof image.complete==='boolean'&&!image.complete))
        throw new TypeError('Image atlas not ready '+cmd.imageId);
      var size=dimensions(image);
      if(!rect(cmd.source)||!rect(cmd.dest)||cmd.source.x<0||cmd.source.y<0||
        !number(size.w,1,16384)||!number(size.h,1,16384)||
        cmd.source.x+cmd.source.w>size.w||cmd.source.y+cmd.source.h>size.h)
        throw new TypeError('Image atlas rectangle invalid '+index);
    }else throw new TypeError('Unknown draw command '+cmd.type);
  });
  function number(v,a,b){return Number.isInteger(v)&&v>=a&&v<=b;}
  ctx.save();
  try{
    ctx.imageSmoothingEnabled=false;
    ctx.beginPath();ctx.rect(0,0,scene.width,scene.height);ctx.clip();
    scene.commands.forEach(function(cmd){
      if(cmd.type==='clear'){
        ctx.fillStyle=cmd.color;ctx.fillRect(0,0,scene.width,scene.height);
      }else{
        var s=cmd.source,d=cmd.dest;
        ctx.drawImage(atlases[cmd.imageId],s.x,s.y,s.w,s.h,d.x,d.y,d.w,d.h);
        drawn++;
      }
    });
  }finally{ctx.restore();}
  return {spritesDrawn:drawn,commandCount:scene.commands.length};
}
if(typeof module!=='undefined'&&module.exports)module.exports=drawBearframeSceneCanvas;
