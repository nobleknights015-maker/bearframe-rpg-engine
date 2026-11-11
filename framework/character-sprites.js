/* Port of Chris's Engine v1 CharacterSpriteRenderer: directional 3x4
 * character sheets and deterministic animation frames. No Plushbound art,
 * scene state, or Android dependencies. Original:
 * https://github.com/nobleknights015-maker/Plushbound-Legends-mobile/blob/engine-v1-rebuild/engine/src/render/CharacterSpriteRenderer.js
 * Adapted to the portable Node/Rhino/WebView source format.
 */
function createBearframeCharacterSpriteRenderer(config){
  config=config||{};
  function positive(n){return Number.isInteger(n)&&n>0&&n<=8192;}
  function nonNegative(n){return Number.isInteger(n)&&n>=0&&n<=8192;}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  if(typeof config.atlas!=='string'||!config.atlas)
    throw new TypeError('Character sheet atlas ID required');
  var fw=config.frameWidth===undefined?48:config.frameWidth;
  var fh=config.frameHeight===undefined?48:config.frameHeight;
  var columns=config.columns===undefined?3:config.columns;
  var rows=config.rows===undefined?4:config.rows;
  var x=config.x===undefined?0:config.x,y=config.y===undefined?0:config.y;
  var duration=config.stepDurationMs===undefined?150:config.stepDurationMs;
  var frames=config.stepFrames===undefined?[0,1,2,1]:config.stepFrames;
  if(!positive(fw)||!positive(fh)||!positive(columns)||!positive(rows)||
     !nonNegative(x)||!nonNegative(y)||!positive(duration)||
     !Array.isArray(frames)||!frames.length||frames.length>32||
     frames.some(function(n){return !nonNegative(n)||n>=columns;}))
    throw new TypeError('Invalid directional character sheet geometry');
  var dirs={'2':0,'4':1,'6':2,'8':3,
    down:0,left:1,right:2,up:3};
  function frameFor(options){
    options=options||{};
    var index=dirs[String(options.direction===undefined?'down':options.direction)];
    var row=clamp(index===undefined?0:index,0,rows-1);
    var col;
    if(options.pattern!==undefined&&options.pattern!==null){
      if(!Number.isInteger(options.pattern))
        throw new TypeError('Character frame pattern must be integer');
      col=clamp(options.pattern,0,columns-1);
    }else if(!options.moving)col=Math.min(1,columns-1);
    else{
      var elapsed=Number(options.elapsedMs);
      if(!isFinite(elapsed)||elapsed<0)elapsed=0;
      col=frames[Math.floor(elapsed/duration)%frames.length];
    }
    return {column:col,row:row,sx:x+col*fw,sy:y+row*fh,sw:fw,sh:fh};
  }
  return Object.freeze({atlas:config.atlas,frameWidth:fw,frameHeight:fh,
    columns:columns,rows:rows,offsetX:x,offsetY:y,
    frameFor:frameFor});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeCharacterSpriteRenderer;
