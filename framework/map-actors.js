/* Bearframe map-event actor bridge.
 * Adapted from Chris's Engine v1 MapRuntime.eventsAt/resolveEvent and
 * TilemapRenderer sprite-list contracts:
 * https://github.com/nobleknights015-maker/Plushbound-Legends-mobile/tree/engine-v1-rebuild/engine/src
 *
 * Static event visuals are presentation only. They are derived from the
 * validated project and canonical saved flags, not independent gameplay
 * state. A one-shot event disappears after its durable event flag is set.
 * No artwork is inferred: only explicitly provided sprite IDs are drawn.
 */
function createBearframeMapActors(project,theme){
  if(!project||!project.maps||!project.events||!theme||!theme.sprites)
    throw new TypeError('Map actors require project maps, events and a sprite theme');
  var own=Object.prototype.hasOwnProperty;
  function has(o,k){return !!o&&own.call(o,k);}
  return function visibleActors(mapId,flags){
    if(!has(project.maps,mapId))throw new TypeError('Unknown map for actor presentation');
    var map=project.maps[mapId],actors=[],mapEvents=map.events||{};
    flags=flags||{};
    Object.keys(mapEvents).sort().forEach(function(location){
      var eventId=mapEvents[location],event=project.events[eventId];
      // Some map events are invisible triggers. They receive no fabricated
      // sprite unless the game project explicitly configures one.
      var sprite=theme.eventSprites&&theme.eventSprites[eventId]||eventId;
      if(!has(theme.sprites,sprite))return;
      if(!event||event.once&&flags['event:'+mapId+':'+location])return;
      var match=/^(0|[1-9][0-9]*),(0|[1-9][0-9]*)$/.exec(location);
      if(!match)throw new TypeError('Invalid actor event location '+location);
      var x=Number(match[1]),y=Number(match[2]);
      if(!map.rows[y]||map.rows[y][x]===undefined||map.rows[y][x]==='#')
        throw new TypeError('Actor event outside walkable map '+location);
      actors.push({id:'event:'+eventId+':'+location,
        x:x,y:y,sprite:sprite});
    });
    return actors;
  };
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeMapActors;
