/* Bearframe scene composer - pure presentation contract, no Canvas/DOM/Android calls.
 * Produces a deterministic, camera-clipped sprite command list for any host renderer.
 */
function createBearframeSceneComposer(project,theme){
  var validate=(typeof module!=='undefined'&&module.exports)?require('./schema.js'):validateEngineProject;
  validate(project);
  var own=Object.prototype.hasOwnProperty;
  function has(o,k){return !!o&&own.call(o,k);}
  function integer(v,a,b){return Number.isInteger(v)&&v>=a&&v<=b;}
  if(!theme||typeof theme!=='object'||!integer(theme.tileSize,8,128))
    throw new TypeError('theme.tileSize must be 8..128');
  if(!theme.atlases||typeof theme.atlases!=='object')throw new TypeError('theme atlases required');
  var color=/^#[0-9a-fA-F]{6}$/;
  if(typeof theme.clearColor!=='string'||!color.test(theme.clearColor))
    throw new TypeError('theme.clearColor requires #rrggbb');
  var atlasKeys=Object.keys(theme.atlases);
  if(!atlasKeys.length)throw new TypeError('at least one texture atlas required');
  atlasKeys.forEach(function(id){
    var size=theme.atlases[id];
    if(!size||!integer(size.width,1,8192)||!integer(size.height,1,8192))
      throw new TypeError('invalid texture atlas '+id);
  });
  function verifyFrame(frame,context){
    if(!frame||!has(theme.atlases,frame.atlas))throw new TypeError(context+' missing atlas');
    var a=theme.atlases[frame.atlas];
    ['x','y','w','h'].forEach(function(k){
      if(!integer(frame[k],k==='w'||k==='h'?1:0,8192))
        throw new TypeError(context+' invalid frame '+k);
    });
    if(frame.x+frame.w>a.width||frame.y+frame.h>a.height)
      throw new TypeError(context+' frame outside atlas');
  }
  if(!theme.tiles||!theme.tiles.floor||!theme.tiles.wall)
    throw new TypeError('floor and wall tile frames required');
  verifyFrame(theme.tiles.floor,'floor');
  verifyFrame(theme.tiles.wall,'wall');
  if(theme.tiles.floor.w!==theme.tileSize||theme.tiles.floor.h!==theme.tileSize||
    theme.tiles.wall.w!==theme.tileSize||theme.tiles.wall.h!==theme.tileSize)
    throw new TypeError('tile frames must match tileSize');
  if(!theme.sprites||!theme.sprites.player)
    throw new TypeError('player animation required');
  Object.keys(theme.sprites).forEach(function(id){
    var a=theme.sprites[id];
    if(!a||!Array.isArray(a.frames)||!a.frames.length||a.frames.length>128||
      !integer(a.ticksPerFrame,1,1000))
      throw new TypeError('invalid animation '+id);
    a.frames.forEach(function(frame,i){verifyFrame(frame,id+'['+i+']');});
  });
  function frameFor(name,tick){
    var spec=theme.sprites[name];
    if(!spec)throw new TypeError('Unknown sprite '+name);
    return spec.frames[Math.floor(tick/spec.ticksPerFrame)%spec.frames.length];
  }
  function compose(view,options){
    options=options||{};
    if(!view||!has(project.maps,view.map)||!Array.isArray(view.rows)||!integer(view.x,0,9999)||!integer(view.y,0,9999))
      throw new TypeError('Invalid scene view');
    var map=project.maps[view.map];
    if(view.rows.length!==map.rows.length||view.rows.some(function(r,i){return r!==map.rows[i];}))
      throw new TypeError('View map rows disagree with project geometry');
    var width=options.width===undefined?320:options.width;
    var height=options.height===undefined?240:options.height;
    var tick=options.tick===undefined?0:options.tick;
    if(!integer(width,16,4096)||!integer(height,16,4096)||!integer(tick,0,2147483647))
      throw new TypeError('Invalid viewport or animation tick');
    var ts=theme.tileSize, worldW=map.rows[0].length*ts,worldH=map.rows.length*ts;
    function camera(target,extent,worldExtent){
      if(worldExtent<=extent)return Math.floor((worldExtent-extent)/2);
      return Math.max(0,Math.min(worldExtent-extent,Math.floor(target-extent/2)));
    }
    var cx=camera((view.x+0.5)*ts,width,worldW);
    var cy=camera((view.y+0.5)*ts,height,worldH);
    var commands=[{type:'clear',color:theme.clearColor}];
    var minX=Math.max(0,Math.floor(cx/ts)),minY=Math.max(0,Math.floor(cy/ts));
    var maxX=Math.min(map.rows[0].length,Math.ceil((cx+width)/ts));
    var maxY=Math.min(map.rows.length,Math.ceil((cy+height)/ts));
    for(var y=minY;y<maxY;y++)for(var x=minX;x<maxX;x++){
      var f=map.rows[y][x]==='#'?theme.tiles.wall:theme.tiles.floor;
      commands.push({type:'sprite',imageId:f.atlas,
        source:{x:f.x,y:f.y,w:f.w,h:f.h},
        dest:{x:x*ts-cx,y:y*ts-cy,w:ts,h:ts},
        layer:0,world:{x:x,y:y}});
    }
    var actors=[{id:'player',x:view.x,y:view.y,sprite:'player'}];
    if(options.actors!==undefined){
      if(!Array.isArray(options.actors)||options.actors.length>200)
        throw new TypeError('Invalid scene actors');
      options.actors.forEach(function(a,i){
        if(!a||typeof a.id!=='string'||!a.id||a.id==='player'||!integer(a.x,0,map.rows[0].length-1)||
          !integer(a.y,0,map.rows.length-1)||map.rows[a.y][a.x]==='#'||typeof a.sprite!=='string')
          throw new TypeError('Invalid scene actor '+i);
        actors.push({id:a.id,x:a.x,y:a.y,sprite:a.sprite});
      });
    }
    actors.sort(function(a,b){return a.y-b.y||(a.id<b.id?-1:a.id>b.id?1:0);});
    actors.forEach(function(a){
      var frame=frameFor(a.sprite,tick);
      var px=Math.floor((a.x+0.5)*ts-frame.w/2-cx);
      var py=Math.floor((a.y+1)*ts-frame.h-cy);
      if(px+frame.w<=0||py+frame.h<=0||px>=width||py>=height)return;
      commands.push({type:'sprite',imageId:frame.atlas,
        source:{x:frame.x,y:frame.y,w:frame.w,h:frame.h},
        dest:{x:px,y:py,w:frame.w,h:frame.h},
        layer:1,actor:a.id,world:{x:a.x,y:a.y}});
    });
    return {width:width,height:height,tick:tick,camera:{x:cx,y:cy},
      map:view.map,visibleTiles:(maxX-minX)*(maxY-minY),commands:commands};
  }
  return Object.freeze({tileSize:theme.tileSize,compose:compose});
}
if(typeof module!=='undefined'&&module.exports)module.exports=createBearframeSceneComposer;
