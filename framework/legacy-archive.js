/* Non-destructive historical Rhino v1 recovery vault.
 * This is EXACT-BYTE archival, not conversion into a playable new engine state.
 * Does not write, delete or rename the legacy Activity preference.
 * Explicit inspect -> user-triggered confirm; destination two-slot journal
 * and source are rechecked immediately before committing.
 */
function createBearframeLegacyArchive(source,storage){
  if(!source||typeof source.read!=='function'||!storage||
    typeof storage.read!=='function'||typeof storage.write!=='function')
    throw new TypeError('Explicit read-only legacy source and durable journal storage required');
  var node=(typeof module!=='undefined'&&module.exports);
  var slots=node?require('./save-slots.js'):createBearframeSaveSlots;
  var legacy=node?require('./legacy-save-v1.js'):BearframeLegacyV1;
  var sourceKey='expedition',origin='ExpeditionActivity/expedition';
  var archiveEngine={
    projectId:'legacy-v1-archive',version:1,
    restore:function(raw){
      try{
        var item=typeof raw==='string'?JSON.parse(raw):JSON.parse(JSON.stringify(raw));
        if(!item||typeof item!=='object'||Array.isArray(item)||
           Object.keys(item).length!==5||item.version!==1||
           item.project!=='legacy-v1-archive'||item.sequence!==0||
           item.origin!==origin||typeof item.payload!=='string')
          return null;
        legacy.decode(item.payload);
        return item;
      }catch(error){return null;}
    },
    serialize:function(state){
      var body=JSON.stringify(state);
      if(!this.restore(body))throw new TypeError('Invalid historical save archive');
      return body;
    }
  };
  var journal=slots(archiveEngine,storage,'bf:legacy-v1-archive:v1:backup');
  var staged=null;
  function health(){return journal.health();}
  function readSource(){return source.read(sourceKey);}
  function summary(raw){
    var s=legacy.decode(raw);
    return {name:s.name,finish:s.finish,area:s.area,
      x:s.x,y:s.y,hasBattle:s.battle!==null,hasPrompt:s.prompt!==null};
  }
  function inspect(){
    staged=null;
    var h=health();
    if(h.conflict||h.occupiedSlots!==0)return {ok:false,reason:'archive-occupied'};
    var raw;
    try{raw=readSource();}catch(error){return {ok:false,reason:'source-unreadable'};}
    if(typeof raw!=='string'||!raw.length)return {ok:false,reason:'source-missing'};
    try{
      var description=summary(raw);
      staged=raw;
      return {ok:true,reason:null,summary:description,bytes:raw.length};
    }catch(error){return {ok:false,reason:'invalid-legacy-save'};}
  }
  function confirm(){
    if(staged===null)return {ok:false,reason:'not-inspected'};
    var raw=staged;staged=null;
    var h=health();
    if(h.conflict||h.occupiedSlots!==0)return {ok:false,reason:'archive-occupied'};
    var current;
    try{current=readSource();}catch(error){return {ok:false,reason:'source-unreadable'};}
    if(current!==raw)return {ok:false,reason:'source-changed'};
    try{summary(raw);}catch(error){return {ok:false,reason:'invalid-legacy-save'};}
    var state={version:1,project:'legacy-v1-archive',sequence:0,origin:origin,payload:raw};
    var result=journal.save(state);
    if(!result||!result.ok)return {ok:false,reason:result&&result.reason||'write-failed'};
    var recovered=journal.load();
    if(!recovered||recovered.payload!==raw)return {ok:false,reason:'verify-failed'};
    try{
      if(readSource()!==raw)return {ok:false,reason:'source-changed-after-archive'};
    }catch(error){return {ok:false,reason:'source-unreadable-after-archive'};}
    return {ok:true,reason:null,summary:summary(raw),bytes:raw.length};
  }
  function audit(){
    var h=health();
    if(h.conflict)return {ok:false,reason:'archive-conflict'};
    if(h.occupiedSlots===0)return {ok:false,reason:'no-archive'};
    if(h.validSlots===0)return {ok:false,reason:'unreadable-archive'};
    var state=journal.load();
    if(!state)return {ok:false,reason:'unreadable-archive'};
    var sourceMatches=false,sourceAccessible=false;
    try{
      var current=readSource();
      sourceAccessible=typeof current==='string';
      sourceMatches=current===state.payload;
    }catch(error){}
    return {ok:true,reason:null,summary:summary(state.payload),
      sourceMatches:sourceMatches,sourceAccessible:sourceAccessible,
      bytes:state.payload.length,archiveValidSlots:h.validSlots};
  }
  function exactCopy(){
    var state=journal.load();
    if(!state)return {ok:false,reason:'no-readable-archive'};
    if(!archiveEngine.restore(state))return {ok:false,reason:'invalid-archive'};
    return {ok:true,raw:state.payload};
  }
  return Object.freeze({inspect:inspect,confirm:confirm,audit:audit,
    exactCopy:exactCopy,health:health});
}
if(typeof module!=='undefined'&&module.exports)
 module.exports=createBearframeLegacyArchive;
