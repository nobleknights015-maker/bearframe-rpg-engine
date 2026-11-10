/* Pure session-backed party battle diagnostic.
 * No campaign data; the same versioned runtime/journal used in Android WebView.
 * A separate project namespace prevents touching legacy or v1 fixture saves.
 */
function createBearframePartyProbe(storage) {
  var node=(typeof module!=='undefined'&&module.exports);
  var factory=node?require('../framework/session.js'):createBearframeSession;
  var project=node?require('../fixtures/party-engine-project.js'):FRAMEWORK_PARTY_FIXTURE;
  var session=factory(project,storage,null,
    {slotPrefix:'bf:framework-party-test:v2:diagnostics'});
  var result=session.resume();
  if(!result.ok&&result.reason==='no-save')
    result=session.start('Party diagnostic',1517);
  var startupError=result.ok?null:result.reason;
  function snapshot() {
    var snap=session.snapshot(),view=snap.view;
    var battle=view&&view.partyBattle&&view.partyBattle.encounter;
    return {ready:!!snap.started,error:startupError||snap.error,
      engineVersion:snap.engineVersion,sequence:view?view.sequence:null,
      phase:battle?battle.phase:'none',targetHp:battle?battle.foes[0].hp:null,
      partyCount:battle?battle.party.length:null,
      playerHp:battle?battle.party[0].hp:null,
      savedRevision:snap.journal.latestSequence,
      validSlots:snap.journal.validSlots};
  }
  function begin() {
    if(startupError)return {ok:false,reason:startupError};
    var snap=snapshot();
    if(snap.phase!=='none')return {ok:false,reason:'already-in-battle'};
    if(snap.sequence!==0)return {ok:false,reason:'not-new'};
    var route=['down','down','right','right','up','up'];
    for(var i=0;i<route.length;i++){
      var outcome=session.dispatch({type:'move',dir:route[i]});
      if(!outcome.ok)return {ok:false,reason:outcome.reason};
    }
    var current=snapshot();
    return {ok:current.phase==='active',reason:current.phase==='active'?null:'no-encounter'};
  }
  function round() {
    if(startupError)return {ok:false,reason:startupError};
    var view=session.snapshot().view;
    if(!view||!view.partyBattle)return {ok:false,reason:'not-in-battle'};
    var battle=view.partyBattle.encounter,target=battle.foes[0];
    var orders=battle.party.filter(function(a){return a.hp>0;}).map(function(a){
      return {actor:a.id,skill:'strike',target:target.id};
    });
    return session.dispatch({type:'party-round',orders:orders});
  }
  return Object.freeze({snapshot:snapshot,begin:begin,round:round});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframePartyProbe;
