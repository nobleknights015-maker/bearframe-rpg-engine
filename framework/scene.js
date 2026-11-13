/* Bearframe scene composer - pure presentation contract, no Canvas/DOM/Android calls.
 * Produces a deterministic, camera-clipped sprite command list for any host renderer.
 */
function createBearframeSceneComposer(project,theme){
  var validate=(typeof module!=='undefined'&&module.exports)?require('./schema.js'):validateEngineProject;
  validate(project);
  // The renderer must keep exactly the same validated map geometry even if a
  // caller reuses and later edits their project/theme objects.
  try{project=JSON.parse(JSON.stringify(project));}
  catch(error){throw new TypeError('Scene project must be JSON-serializable');}
  validate(project);
  var own=Object.prototype.hasOwnProperty;
  function has(o,k){return !!o&&own.call(o,k);}
  function integer(v,a,b){return Number.isInteger(v)&&v>=a&&v<=b;}
  if(!theme||typeof theme!=='object')
    throw new TypeError('theme.tileSize must be 8..128');
  try{theme=JSON.parse(JSON.stringify(theme));}
  catch(error){throw new TypeError('Scene theme must be JSON-serializable');}
  if(!theme||!integer(theme.tileSize,8,128))
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
  // Every tile referenced by visual scenery layers is an atlas-backed tile.
  // Collision still comes exclusively from project.maps[*].rows.
  // Animated tiles use the existing deterministic presentation tick, never
  // simulation state. Old static theme entries remain unchanged.
  Object.keys(theme.tiles).forEach(function(id){
    var tile=theme.tiles[id];
    if(tile&&has(tile,'frames')){
      if(!Array.isArray(tile.frames)||!tile.frames.length||
         tile.frames.length>128||!integer(tile.ticksPerFrame,1,1000))
        throw new TypeError('Invalid animated tile '+id);
      if(has(tile,'atlas')||has(tile,'x')||has(tile,'y')||
         has(tile,'w')||has(tile,'h'))
        throw new TypeError('Animated tile cannot include static frame '+id);
      tile.frames.forEach(function(frame,index){
        verifyFrame(frame,'tile '+id+'['+index+']');
        if(frame.w!==theme.tileSize||frame.h!==theme.tileSize)
          throw new TypeError('tile frames must match tileSize');
      });
    }else{
      verifyFrame(tile,'tile '+id);
      if(tile.w!==theme.tileSize||tile.h!==theme.tileSize)
        throw new TypeError('tile frames must match tileSize');
    }
  });
  // Optional authored map appearance and visible exit/door frames. Each role
  // refers to an original pixel atlas rectangle; collision and warp rules
  // still live exclusively in project.maps[*].rows and .exits.
  var mapTiles=theme.mapTiles||{},portals=theme.portals||{};
  if(typeof mapTiles!=='object'||Array.isArray(mapTiles)||
     typeof portals!=='object'||Array.isArray(portals))
    throw new TypeError('Invalid map tile or portal appearance');
  Object.keys(mapTiles).forEach(function(mapId){
    if(!has(project.maps,mapId))throw new TypeError('Unknown map tile appearance '+mapId);
    var roles=mapTiles[mapId];
    if(!roles||typeof roles!=='object'||Array.isArray(roles)||
       Object.keys(roles).some(function(k){return k!=='floor'&&k!=='wall';}))
      throw new TypeError('Invalid map tile appearance '+mapId);
    Object.keys(roles).forEach(function(k){
      if(typeof roles[k]!=='string'||!has(theme.tiles,roles[k]))
        throw new TypeError('Unknown map tile role '+mapId+'.'+k);
    });
  });
  Object.keys(portals).forEach(function(mapId){
    if(!has(project.maps,mapId))throw new TypeError('Unknown portal map '+mapId);
    verifyFrame(portals[mapId],'portal '+mapId);
  });
  function tileFrame(name,tick){
    var tile=theme.tiles[name];
    return has(tile,'frames')?
      tile.frames[Math.floor(tick/tile.ticksPerFrame)%tile.frames.length]:tile;
  }
  var scenery={};
  Object.keys(project.maps).forEach(function(mapId){
    var layers=project.maps[mapId].visualLayers||[];
    var prepared={ground:{},canopy:{}};
    layers.forEach(function(layer,layerIndex){
      var rows=prepared[layer.depth];
      Object.keys(layer.cells).forEach(function(at){
        var tileId=layer.cells[at];
        if(!has(theme.tiles,tileId))
          throw new TypeError('Unknown visual tile '+tileId+' on '+mapId);
        var xy=at.split(','),x=+xy[0],y=+xy[1];
        if(!rows[y])rows[y]=[];
        rows[y].push({x:x,tileId:tileId,order:layerIndex});
      });
    });
    ['ground','canopy'].forEach(function(depth){
      Object.keys(prepared[depth]).forEach(function(y){
        // Rhino and Chromium need identical painter order when two
        // layers place different art at the same coordinate.
        prepared[depth][y].sort(function(a,b){return a.x-b.x||a.order-b.order;});
      });
    });
    scenery[mapId]=prepared;
  });
  if(!theme.sprites||!theme.sprites.player)
    throw new TypeError('player animation required');
  // Engine v1 CharacterSpriteRenderer handles proper 3x4 facing/walk frames.
  // Legacy flat frame arrays remain supported without any save migration.
  var charFactory=(typeof module!=='undefined'&&module.exports)?
    require('./character-sprites.js'):createBearframeCharacterSpriteRenderer;
  var sheetRenderers={};
  Object.keys(theme.sprites).forEach(function(id){
    var a=theme.sprites[id];
    if(a&&a.directions){
      // Explicit authored directional frames can live on different original
      // atlases (idle sheet vs walk sheet), with arbitrary row order.
      // Never assume a third-party source follows our 3x4 sheet convention.
      if(a.frames!==undefined||a.sheet!==undefined||
         !integer(a.ticksPerFrame,1,1000)||
         !a.directions||typeof a.directions!=='object'||Array.isArray(a.directions))
        throw new TypeError('Invalid directional animation '+id);
      var cardinal=['down','left','right','up'];
      var available=Object.keys(a.directions);
      if(available.length!==4||available.some(function(k){
        return cardinal.indexOf(k)<0;
      }))throw new TypeError('Four directional poses required '+id);
      cardinal.forEach(function(dir){
        var pose=a.directions[dir];
        if(!pose||typeof pose!=='object'||Array.isArray(pose)||
           Object.keys(pose).length!==2||!has(pose,'idle')||
           !Array.isArray(pose.walk)||!pose.walk.length||pose.walk.length>32)
          throw new TypeError('Invalid directional pose '+id+' '+dir);
        verifyFrame(pose.idle,id+'.'+dir+'.idle');
        pose.walk.forEach(function(f,i){
          verifyFrame(f,id+'.'+dir+'.walk['+i+']');
        });
      });
      return;
    }
    if(a&&a.sheet){
      if(a.frames!==undefined)throw new TypeError('Choose frames or sheet '+id);
      var render=charFactory(a.sheet);
      if(!has(theme.atlases,render.atlas))throw new TypeError('Missing sheet atlas '+id);
      var atlas=theme.atlases[render.atlas];
      if(render.offsetX+render.frameWidth*render.columns>atlas.width||
         render.offsetY+render.frameHeight*render.rows>atlas.height)
        throw new TypeError('Directional sheet outside atlas '+id);
      sheetRenderers[id]=render;
      return;
    }
    if(!a||!Array.isArray(a.frames)||!a.frames.length||a.frames.length>128||
      !integer(a.ticksPerFrame,1,1000))
      throw new TypeError('invalid animation '+id);
    a.frames.forEach(function(frame,i){verifyFrame(frame,id+'['+i+']');});
  });
  function frameFor(name,tick,direction,moving,pattern){
    var spec=theme.sprites[name];
    if(!spec)throw new TypeError('Unknown sprite '+name);
    if(spec.directions){
      var pose=spec.directions[has(spec.directions,direction)?direction:'down'];
      return moving?pose.walk[Math.floor(tick/spec.ticksPerFrame)%pose.walk.length]:
        pose.idle;
    }
    if(sheetRenderers[name]){
      // Scene ticks are deterministic; a host may supply a presentation
      // clock, but renderer state is never written to the save journal.
      var frame=sheetRenderers[name].frameFor({direction:direction,
        moving:!!moving,elapsedMs:tick*50,pattern:pattern});
      return {atlas:sheetRenderers[name].atlas,
        x:frame.sx,y:frame.sy,w:frame.sw,h:frame.sh};
    }
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
    var ts=theme.tileSize,worldW=map.rows[0].length*ts,worldH=map.rows.length*ts;
    // Opt-in canonical fixed-point motion is saved by the engine, not the
    // renderer. Use its precise coordinates for actor pixels and camera
    // tracking while retaining integer coordinates for events/collision.
    var precise=view.freePosition;
    if(precise!==undefined){
      if(!precise||typeof precise!=='object'||Array.isArray(precise)||
         typeof precise.x!=='number'||typeof precise.y!=='number'||
         !isFinite(precise.x)||!isFinite(precise.y)||
         Math.floor(precise.x+0.5)!==view.x||
         Math.floor(precise.y+0.5)!==view.y||
         precise.x< -0.5||precise.y< -0.5||
         precise.x>map.rows[0].length-0.5||
         precise.y>map.rows.length-0.5)
        throw new TypeError('Invalid precise player position');
    }
    var display=options.playerDrawPosition;
    if(display!==undefined){
      var reference=precise||{x:view.x,y:view.y};
      if(!display||typeof display!=='object'||Array.isArray(display)||
         typeof display.x!=='number'||typeof display.y!=='number'||
         !isFinite(display.x)||!isFinite(display.y)||
         Math.abs(display.x-reference.x)>1||
         Math.abs(display.y-reference.y)>1)
        throw new TypeError('Invalid player presentation position');
    }
    // Optional fractional tile-coordinate focus for scripted scenes and
    // camera pans. The player remains at the canonical view position.
    // The host owns interpolation; the scene composer stays stateless.
    var focus=options.cameraTarget;
    if(focus!==undefined){
      if(!focus||typeof focus!=='object'||Array.isArray(focus)||
         typeof focus.x!=='number'||typeof focus.y!=='number'||
         !isFinite(focus.x)||!isFinite(focus.y)||
         focus.x<0||focus.y<0||
         focus.x>=map.rows[0].length||focus.y>=map.rows.length)
        throw new TypeError('Invalid scene camera target');
    }else focus=precise?{
      x:Math.max(0,Math.min(map.rows[0].length-1,precise.x)),
      y:Math.max(0,Math.min(map.rows.length-1,precise.y))
    }:{x:view.x,y:view.y};
    function camera(target,extent,worldExtent){
      if(worldExtent<=extent)return Math.floor((worldExtent-extent)/2);
      return Math.max(0,Math.min(worldExtent-extent,Math.floor(target-extent/2)));
    }
    var cx=camera((focus.x+0.5)*ts,width,worldW);
    var cy=camera((focus.y+0.5)*ts,height,worldH);
    var commands=[{type:'clear',color:theme.clearColor}];
    var minX=Math.max(0,Math.floor(cx/ts)),minY=Math.max(0,Math.floor(cy/ts));
    var maxX=Math.min(map.rows[0].length,Math.ceil((cx+width)/ts));
    var maxY=Math.min(map.rows.length,Math.ceil((cy+height)/ts));
    var appearance=mapTiles[view.map]||{};
    for(var y=minY;y<maxY;y++)for(var x=minX;x<maxX;x++){
      var base=map.rows[y][x]==='#'?'wall':'floor';
      var f=tileFrame(appearance[base]||base,tick);
      commands.push({type:'sprite',imageId:f.atlas,
        source:{x:f.x,y:f.y,w:f.w,h:f.h},
        dest:{x:x*ts-cx,y:y*ts-cy,w:ts,h:ts},
        layer:0,world:{x:x,y:y}});
    }
    function addScenery(depth,layer){
      var rows=scenery[view.map][depth];
      for(var y=minY;y<maxY;y++){
        var entries=rows[y]||[];
        for(var i=0;i<entries.length;i++){
          var tile=entries[i];
          if(tile.x<minX||tile.x>=maxX)continue;
          var f=tileFrame(tile.tileId,tick);
          commands.push({type:'sprite',imageId:f.atlas,
            source:{x:f.x,y:f.y,w:f.w,h:f.h},
            dest:{x:tile.x*ts-cx,y:y*ts-cy,w:ts,h:ts},
            layer:layer,world:{x:tile.x,y:y}});
        }
      }
    }
    // Draw in painter order, not just layer metadata order: both browser
    // Canvas and native Android Canvas process commands sequentially.
    addScenery('ground',0.5);
    // Every gameplay exit receives a recognizable original door sprite when
    // the art theme supplies one. Door bottom sits exactly on exit tile feet;
    // painter order allows the player to appear in front of a tall doorway.
    var portal=portals[view.map];
    if(portal){
      Object.keys(map.exits).sort().forEach(function(at){
        var xy=at.split(','),x=+xy[0],y=+xy[1];
        var dx=Math.floor((x+0.5)*ts-portal.w/2-cx);
        var dy=(y+1)*ts-portal.h-cy;
        if(dx+portal.w<=0||dy+portal.h<=0||dx>=width||dy>=height)return;
        commands.push({type:'sprite',imageId:portal.atlas,
          source:{x:portal.x,y:portal.y,w:portal.w,h:portal.h},
          dest:{x:dx,y:dy,w:portal.w,h:portal.h},
          layer:0.75,exit:{map:map.exits[at].map,x:x,y:y}});
      });
    }
    var actors=[{id:'player',
      x:display?display.x:precise?precise.x:view.x,
      y:display?display.y:precise?precise.y:view.y,sprite:'player',
      direction:options.playerDirection,moving:!!options.playerMoving,
      pattern:options.playerPattern}];
    if(options.actors!==undefined){
      if(!Array.isArray(options.actors)||options.actors.length>200)
        throw new TypeError('Invalid scene actors');
      options.actors.forEach(function(a,i){
        if(!a||typeof a.id!=='string'||!a.id||a.id==='player'||!integer(a.x,0,map.rows[0].length-1)||
          !integer(a.y,0,map.rows.length-1)||map.rows[a.y][a.x]==='#'||typeof a.sprite!=='string')
          throw new TypeError('Invalid scene actor '+i);
        actors.push({id:a.id,x:a.x,y:a.y,sprite:a.sprite,
          direction:a.direction,moving:!!a.moving,pattern:a.pattern});
      });
    }
    actors.sort(function(a,b){return a.y-b.y||(a.id<b.id?-1:a.id>b.id?1:0);});
    actors.forEach(function(a){
      var frame=frameFor(a.sprite,tick,a.direction,a.moving,a.pattern);
      var px=Math.floor((a.x+0.5)*ts-frame.w/2-cx);
      var py=Math.floor((a.y+1)*ts-frame.h-cy);
      if(px+frame.w<=0||py+frame.h<=0||px>=width||py>=height)return;
      commands.push({type:'sprite',imageId:frame.atlas,
        source:{x:frame.x,y:frame.y,w:frame.w,h:frame.h},
        dest:{x:px,y:py,w:frame.w,h:frame.h},
        layer:1,actor:a.id,world:{x:a.x,y:a.y}});
    });
    addScenery('canopy',2);
    return {width:width,height:height,tick:tick,camera:{x:cx,y:cy},
      map:view.map,visibleTiles:(maxX-minX)*(maxY-minY),commands:commands};
  }
  return Object.freeze({tileSize:theme.tileSize,compose:compose});
}
if(typeof module!=='undefined'&&module.exports)module.exports=createBearframeSceneComposer;
