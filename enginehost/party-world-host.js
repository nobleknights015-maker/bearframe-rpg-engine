/* Installed-world v2 diagnostic bridge: one canonical session/journal for
 * events, inventory, equipment, party turns, XP and restarts.
 * Never uses the v1, historical Rhino or independent party-probe namespace.
 */
function createBearframePartyWorldHost(storage,project,theme){
  var node=(typeof module!=='undefined'&&module.exports);
  var factory=node?require('../framework/session.js'):createBearframeSession;
  if(!project||!project.partyCombat||!project.partyCombat.progression)
    throw new TypeError('Opt-in v2 world progression project required');
  var session=factory(project,storage,theme||null,
    {slotPrefix:'bf:framework-party-world-test:v2:diagnostics'});
  var startup=session.resume();
  if(!startup.ok&&startup.reason==='no-save')
    startup=session.start('World integration test',2718);
  var startupError=startup.ok?null:startup.reason;
  // Facing is an ephemeral rendering hint, not part of the world journal.
  // The caller's durable movement action still decides whether position moves.
  var lastFacing='down';
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
    if(['up','down','left','right'].indexOf(dir)===-1)
      return {ok:false,reason:'invalid-direction'};
    var result=dispatch({type:'move',dir:dir});
    // Facing into a wall is visually meaningful; failed storage commits
    // must not change presentation or imply the move succeeded.
    if(result.ok||result.reason==='no-change')lastFacing=dir;
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
