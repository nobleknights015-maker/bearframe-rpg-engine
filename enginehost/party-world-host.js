/* Installed-world v2 diagnostic bridge: one canonical session/journal for
 * events, inventory, equipment, party turns, XP and restarts.
 * Never uses the v1, historical Rhino or independent party-probe namespace.
 */
function createBearframePartyWorldHost(storage,project,theme,options){
  var node=(typeof module!=='undefined'&&module.exports);
  var factory=node?require('../framework/session.js'):createBearframeSession;
  if(!project||!project.partyCombat||!project.partyCombat.progression)
    throw new TypeError('Opt-in v2 world progression project required');
  options=options||{};
  // Existing diagnostic saves keep their exact historical namespace. An
  // authored content project is isolated by its stable validated project ID.
  var slotPrefix=options.slotPrefix===undefined?
    'bf:framework-party-world-test:v2:diagnostics':options.slotPrefix;
  if(typeof slotPrefix!=='string'||!/^bf:[a-z][a-z0-9_-]{0,63}:v2:(diagnostics|runtime)$/.test(slotPrefix))
    throw new TypeError('Invalid v2 content save namespace');
  var session=factory(project,storage,theme||null,{slotPrefix:slotPrefix});
  var startup=session.resume();
  if(!startup.ok&&startup.reason==='no-save')
    startup=session.start('World integration test',2718);
  var startupError=startup.ok?null:startup.reason;
  // Facing is an ephemeral rendering hint, not part of the world journal.
  // The caller's durable movement action still decides whether position moves.
  var lastFacing='down';
  var free=project.movement&&project.movement.mode==='free'?
    (node?require('../framework/free-movement.js'):createBearframeFreeMovement)(project):null;
  function snapshot(){return session.snapshot();}
  function view(){return snapshot().view;}
  function dispatch(command){
    if(startupError)return {ok:false,reason:startupError};
    return session.dispatch(command);
  }
  function battle(){
    var v=view();
    return v&&v.partyBattle?
      JSON.parse(JSON.stringify(v.partyBattle.encounter)):null;
  }
  function submit(orders){
    if(!battle())return {ok:false,reason:'not-in-battle'};
    return dispatch({type:'party-round',orders:orders});
  }
  function navigate(dir){
    var directions=['up','down','left','right'];
    if(free&&free.directions===8)directions=directions.concat([
      'up-left','up-right','down-left','down-right']);
    if(directions.indexOf(dir)===-1)
      return {ok:false,reason:'invalid-direction'};
    var result=dispatch({type:'move',dir:dir});
    // Diagonal locomotion reuses four cardinal animation poses. Preserve
    // whichever compatible cardinal the actor already faced, else prefer
    // the vertical direction. Blocked moves still turn but never save.
    if(result.ok||result.reason==='no-change')
      lastFacing=free?free.facing(dir,lastFacing):dir;
    return result;
  }
  return Object.freeze({snapshot:snapshot,view:view,battle:battle,
    submit:submit,dispatch:dispatch,navigate:navigate,
    facing:function(){return lastFacing;},
    // Scene composition is read-only. The canonical session remains the
    // single source of geometry and journal state across Android restarts.
    compose:function(options){return session.compose(options);},
    planPath:function(destination,options){
      if(startupError)return {ok:false,reason:startupError,
        directions:[],positions:[],cost:0,visited:0};
      return session.planPath(destination,options);
    },
    verifySave:function(){
      if(startupError)return {ok:false,reason:startupError};
      return session.verifySave();
    }});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframePartyWorldHost;
