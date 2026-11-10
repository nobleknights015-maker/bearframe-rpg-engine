/* Lossless playable compatibility for the original Expedition/Rhino v1 save.
 * This is deliberately NOT a translation to incompatible portable gameplay rules:
 * it runs the original frozen step/restore implementation against a COPIED state
 * in a dedicated crash-resistant journal, never writes the original source.
 * Preflight and confirmation require a separately confirmed exact-byte archive.
 * For new projects, use framework/runtime.js; this is a historical adapter.
 */
function createBearframeLegacyCompatibility(config) {
  if(!config||!config.source||typeof config.source.read!=='function'||
     !config.storage||typeof config.storage.read!=='function'||
     typeof config.storage.write!=='function'||!config.original||
     typeof config.original.step!=='function'||
     typeof config.original.restore!=='function')
    throw new TypeError('Read-only legacy source, storage and original game rules required');
  var node=typeof module!=='undefined'&&module.exports;
  var decoder=node?require('./legacy-save-v1.js'):BearframeLegacyV1;
  var makeArchive=node?require('./legacy-archive.js'):createBearframeLegacyArchive;
  var makeSlots=node?require('./save-slots.js'):createBearframeSaveSlots;
  var original=config.original;
  var projectId='legacy-expedition-compat';
  function copy(v){return JSON.parse(JSON.stringify(v));}
  function validLegacy(value) {
    try {
      var raw=JSON.stringify(value);
      decoder.decode(raw);
      var checked=original.restore(raw);
      return !!checked&&JSON.stringify(checked)===raw;
    }catch(e){return false;}
  }
  var engine={
    version:1,projectId:projectId,
    restore:function(raw) {
      try {
        var s=typeof raw==='string'?JSON.parse(raw):copy(raw);
        if(!s||typeof s!=='object'||Array.isArray(s)||
          Object.keys(s).length!==4||s.version!==1||
          s.project!==projectId||!Number.isInteger(s.sequence)||
          s.sequence<0||s.sequence>2147483647||!validLegacy(s.legacy))return null;
        return s;
      }catch(e){return null;}
    },
    serialize:function(s) {
      var body=JSON.stringify(s);
      if(!this.restore(body))throw new TypeError('Invalid historical session');
      return body;
    }
  };
  var prefix='bf:legacy-expedition-compat:v1:session';
  var journal=makeSlots(engine,config.storage,prefix);
  var vault=makeArchive(config.source,config.storage);
  var staged=null,current=null;
  function empty(){
    try{
      var h=journal.health();
      return h&&h.conflict===false&&h.occupiedSlots===0&&h.validSlots===0;
    }catch(e){return false;}
  }
  function archivedSameSource(){
    try {
      var check=vault.audit();
      if(!check.ok)return {ok:false,reason:'backup-missing-or-invalid'};
      if(!check.sourceMatches)return {ok:false,reason:'source-changed'};
      var exact=vault.exactCopy();
      if(!exact.ok||typeof exact.raw!=='string'||
         config.source.read('expedition')!==exact.raw)
        return {ok:false,reason:'source-changed'};
      var legacy=decoder.decode(exact.raw);
      if(!validLegacy(legacy))return {ok:false,reason:'invalid-original'};
      return {ok:true,raw:exact.raw,legacy:legacy};
    }catch(e){return {ok:false,reason:'source-unreadable'};}
  }
  function preflight(){
    staged=null;
    if(!empty())return {ok:false,reason:'destination-occupied'};
    var src=archivedSameSource();
    if(!src.ok)return {ok:false,reason:src.reason};
    staged=src.raw;
    return {ok:true,reason:null,
      location:src.legacy.area,x:src.legacy.x,y:src.legacy.y,
      battle:src.legacy.battle!==null,prompt:src.legacy.prompt!==null};
  }
  function commit(){
    if(staged===null)return {ok:false,reason:'not-staged'};
    var expected=staged;
    staged=null;
    if(!empty())return {ok:false,reason:'destination-occupied'};
    var src=archivedSameSource();
    if(!src.ok)return {ok:false,reason:src.reason};
    if(src.raw!==expected)return {ok:false,reason:'source-changed'};
    var state={version:1,project:projectId,sequence:0,legacy:copy(src.legacy)};
    var saved=journal.save(state);
    if(!saved.ok)return {ok:false,reason:saved.reason};
    var verified=journal.load();
    if(!verified||JSON.stringify(verified)!==JSON.stringify(state))
      return {ok:false,reason:'verify-failed'};
    current=verified;
    return {ok:true,reason:null,sequence:0};
  }
  function resume(){
    var health=journal.health();
    if(health.conflict)return {ok:false,reason:'save-conflict'};
    var recovered=journal.load();
    if(!recovered)return {ok:false,reason:health.occupiedSlots===0?'not-imported':'unreadable-save'};
    current=recovered;
    return {ok:true,reason:null,sequence:current.sequence};
  }
  function dispatch(command){
    if(!current)return {ok:false,reason:'not-started'};
    if(!command||typeof command.type!=='string')
      return {ok:false,reason:'invalid-command'};
    var nextLegacy;
    try {nextLegacy=original.step(copy(current.legacy),copy(command));}
    catch(e){return {ok:false,reason:'step-failed'};}
    if(!validLegacy(nextLegacy))return {ok:false,reason:'invalid-transition'};
    if(JSON.stringify(nextLegacy)===JSON.stringify(current.legacy))
      return {ok:false,reason:'no-change'};
    var next={version:1,project:projectId,sequence:current.sequence+1,legacy:nextLegacy};
    var saved=journal.save(next);
    if(!saved.ok)return {ok:false,reason:saved.reason};
    current=next;
    return {ok:true,reason:null,sequence:current.sequence};
  }
  function snapshot(){
    return {active:!!current,sequence:current?current.sequence:null,
      legacy:current?copy(current.legacy):null,health:journal.health()};
  }
  return Object.freeze({preflight:preflight,commit:commit,resume:resume,
    dispatch:dispatch,snapshot:snapshot,archive:vault,
    namespace:prefix});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeLegacyCompatibility;
