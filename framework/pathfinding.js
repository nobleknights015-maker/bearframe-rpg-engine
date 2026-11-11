/* Bearframe RPG - deterministic, read-only grid navigation planner.
 * Engine v1 map/camera ideas reused without importing game content.
 * NO automatic movement, gameplay state, journal writes or host dependencies.
 * Explicitly avoids unresolved events, encounters and exits by default,
 * because those tiles interrupt normal walking in framework/runtime.js.
 */
function createBearframePathfinder(project){
  var node=(typeof module!=='undefined'&&module.exports);
  var validate=node?require('./schema.js'):validateEngineProject;
  validate(project);
  try{project=JSON.parse(JSON.stringify(project));}
  catch(error){throw new TypeError('Pathfinder project must be serializable');}
  validate(project);
  var hasOwn=Object.prototype.hasOwnProperty;
  function has(o,k){return !!o&&hasOwn.call(o,k);}
  function validPoint(p,width,height){
    return !!p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&
      p.x>=0&&p.y>=0&&p.x<width&&p.y<height;
  }
  function result(ok,reason,map,from,to,directions,positions,visited){
    return {ok:ok,reason:reason,map:map,from:from,to:to,
      directions:directions,positions:positions,cost:directions.length,
      visited:visited};
  }
  function find(view,to,options){
    options=options||{};
    if(!view||typeof view.map!=='string'||!has(project.maps,view.map))
      throw new TypeError('Pathfinder requires a valid map view');
    var map=project.maps[view.map],rows=map.rows,height=rows.length,width=rows[0].length;
    var from={x:view.x,y:view.y},destination={x:to&&to.x,y:to&&to.y};
    if(!validPoint(from,width,height)||rows[from.y][from.x]==='#')
      throw new TypeError('Invalid pathfinder starting cell');
    if(!validPoint(destination,width,height))
      throw new TypeError('Invalid pathfinder destination');
    if(to.map!==undefined&&to.map!==view.map)
      return result(false,'different-map',view.map,from,destination,[],[],0);
    if(options.allowTriggers!==undefined&&typeof options.allowTriggers!=='boolean')
      throw new TypeError('allowTriggers must be boolean');
    if(options.allowDestinationTrigger!==undefined&&
       typeof options.allowDestinationTrigger!=='boolean')
      throw new TypeError('allowDestinationTrigger must be boolean');
    var limit=options.maxNodes===undefined?width*height:options.maxNodes;
    if(!Number.isInteger(limit)||limit<1||limit>65536)
      throw new TypeError('Invalid pathfinder node budget');
    var flags=options.flags||{};
    if(!flags||typeof flags!=='object'||Array.isArray(flags))
      throw new TypeError('Invalid pathfinder event flags');
    var allow=options.allowTriggers===true;
    function blocked(x,y){
      if(rows[y][x]==='#')return 'wall';
      if(allow||(options.allowDestinationTrigger===true&&
          x===destination.x&&y===destination.y))return null;
      var key=x+','+y,origin=view.map+':'+key,evId=map.events[key];
      if(evId){
        var event=project.events[evId];
        if(!event.once||!flags['event:'+origin])return 'trigger';
      }
      if(has(map.encounters,key)&&!flags['encounter:'+origin])return 'trigger';
      if(has(map.exits,key))return 'trigger';
      return null;
    }
    var obstruction=blocked(destination.x,destination.y);
    if(obstruction)return result(false,obstruction,view.map,from,destination,[],[],0);
    var start=from.y*width+from.x,finish=destination.y*width+destination.x;
    if(start===finish)return result(true,null,view.map,from,destination,[],[],1);
    var parent=[],via=[],seen=[],queue=[start],head=0;
    seen[start]=true;
    // Stable tie order: up, left, right, down. No random or wall-clock input.
    var dirs=[['up',0,-1],['left',-1,0],['right',1,0],['down',0,1]];
    while(head<queue.length){
      if(head>=limit)return result(false,'node-limit',view.map,from,destination,[],[],head);
      var index=queue[head++],x=index%width,y=Math.floor(index/width);
      for(var i=0;i<dirs.length;i++){
        var d=dirs[i],nx=x+d[1],ny=y+d[2];
        if(nx<0||ny<0||nx>=width||ny>=height||
           seen[ny*width+nx]||blocked(nx,ny))continue;
        var next=ny*width+nx;
        seen[next]=true;parent[next]=index;via[next]=d[0];
        if(next===finish){
          var reverseDirs=[],reversePoints=[],cur=next;
          while(cur!==start){
            reverseDirs.push(via[cur]);
            reversePoints.push({x:cur%width,y:Math.floor(cur/width)});
            cur=parent[cur];
          }
          reverseDirs.reverse();reversePoints.reverse();
          return result(true,null,view.map,from,destination,
            reverseDirs,reversePoints,head);
        }
        queue.push(next);
      }
    }
    return result(false,'unreachable',view.map,from,destination,[],[],head);
  }
  return Object.freeze({find:find});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframePathfinder;
