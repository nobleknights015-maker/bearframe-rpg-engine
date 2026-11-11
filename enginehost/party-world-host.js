/* Installed-world v2 diagnostic bridge: one canonical session/journal for
 * events, inventory, equipment, party turns, XP and restarts.
 * Never uses the v1, historical Rhino or independent party-probe namespace.
 */
function createBearframePartyWorldHost(storage,project){
  var node=(typeof module!=='undefined'&&module.exports);
  var factory=node?require('../framework/session.js'):createBearframeSession;
  if(!project||!project.partyCombat||!project.partyCombat.progression)
    throw new TypeError('Opt-in v2 world progression project required');
  var session=factory(project,storage,null,
    {slotPrefix:'bf:framework-party-world-test:v2:diagnostics'});
  var startup=session.resume();
  if(!startup.ok&&startup.reason==='no-save')
    startup=session.start('World integration test',2718);
  var startupError=startup.ok?null:startup.reason;
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
    return dispatch({type:'move',dir:dir});
  }
  return Object.freeze({snapshot:snapshot,view:view,battle:battle,
    submit:submit,dispatch:dispatch,navigate:navigate,
    verifySave:function(){
      if(startupError)return {ok:false,reason:startupError};
      return session.verifySave();
    }});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframePartyWorldHost;
