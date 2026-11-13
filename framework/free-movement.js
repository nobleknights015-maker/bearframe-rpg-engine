/* Fixed-point eight-way field locomotion.
 * 256 integer units = one authored map tile. No wall-clock floats, DOM,
 * Android input, renderer state, RNG, or gameplay writes.
 * Collision is a centered square footprint; X/Y sweep permits natural wall
 * sliding without tunneling through diagonally joined wall tiles.
 */
function createBearframeFreeMovement(project){
  if(!project||!project.maps||!project.movement||
     project.movement.mode!=='free')
    throw new TypeError('Free movement requires project.movement.mode=free');
  var SCALE=256;
  var speed=project.movement.speed===undefined?32:project.movement.speed;
  var radius=project.movement.radius===undefined?48:project.movement.radius;
  if(!Number.isInteger(speed)||speed<8||speed>64||
     !Number.isInteger(radius)||radius<8||radius>96)
    throw new TypeError('Invalid free movement speed or radius');
  var vectors={
    up:[0,-1],down:[0,1],left:[-1,0],right:[1,0],
    'up-left':[-1,-1],'up-right':[1,-1],
    'down-left':[-1,1],'down-right':[1,1]
  };
  function point(x,y){
    if(!Number.isInteger(x)||!Number.isInteger(y))
      throw new TypeError('Map position must be integer tiles');
    return {px:x*SCALE+SCALE/2,py:y*SCALE+SCALE/2};
  }
  function inside(mapId,px,py){
    var map=project.maps[mapId];
    if(!map||!Number.isInteger(px)||!Number.isInteger(py))return false;
    var rows=map.rows;
    for(var yi=-1;yi<=1;yi+=2)for(var xi=-1;xi<=1;xi+=2){
      var cx=Math.floor((px+xi*radius)/SCALE);
      var cy=Math.floor((py+yi*radius)/SCALE);
      if(!rows[cy]||rows[cy][cx]!=='.')return false;
    }
    return true;
  }
  function location(p){
    return {x:Math.floor(p.px/SCALE),y:Math.floor(p.py/SCALE),
      px:p.px,py:p.py};
  }
  function walk(mapId,position,direction){
    var pair=vectors[direction];
    if(!pair||!position||!inside(mapId,position.px,position.py))
      return {ok:false,reason:'invalid-position-or-direction',steps:[]};
    // Rational, deterministic sqrt(1/2) approximation. Speed 32 becomes 23
    // units per diagonal axis (32.53 total vs 32 cardinal).
    var stride=pair[0]&&pair[1]?Math.max(1,Math.floor((speed*181+128)/256)):speed;
    var px=position.px,py=position.py,steps=[];
    var deltaX=pair[0]*stride,deltaY=pair[1]*stride;
    if(deltaX&&inside(mapId,px+deltaX,py)){
      px+=deltaX;steps.push(location({px:px,py:py}));
    }
    if(deltaY&&inside(mapId,px,py+deltaY)){
      py+=deltaY;steps.push(location({px:px,py:py}));
    }
    return {ok:steps.length>0,reason:steps.length?'moved':'blocked',
      steps:steps};
  }
  function facing(direction,previous){
    if(!Object.prototype.hasOwnProperty.call(vectors,direction))
      return null;
    if(direction.indexOf('-')<0)return direction;
    var bits=direction.split('-');
    return bits.indexOf(previous)>=0?previous:bits[0];
  }
  return Object.freeze({scale:SCALE,speed:speed,radius:radius,
    point:point,inside:inside,walk:walk,facing:facing});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeFreeMovement;
