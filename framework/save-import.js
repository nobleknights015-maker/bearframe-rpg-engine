/* Bearframe Engine Kit: conservative, opt-in save import.
 * Never reads or writes the legacy launcher namespace implicitly.
 * Callers supply an explicitly reviewed legacy decoder and mapper.
 * Source storage is read-only; destination uses the verified two-slot journal.
 */
function createBearframeSaveImporter(config) {
  if(!config||!config.source||!config.destination||!config.engine||
    typeof config.source.read!=='function'||
    typeof config.destination.health!=='function'||
    typeof config.destination.save!=='function'||
    typeof config.engine.serialize!=='function'||
    typeof config.engine.restore!=='function'||
    typeof config.decode!=='function'||typeof config.map!=='function')
    throw new TypeError('Explicit source, journal, engine, decoder and mapper required');
  var key=config.sourceKey;
  if(typeof key!=='string'||!/^[a-z][a-z0-9:_-]{0,127}$/.test(key))
    throw new TypeError('Explicit source key required');
  var staged=null;
  function targetEmpty() {
    var h=config.destination.health();
    return h&&!h.conflict&&h.occupiedSlots===0&&h.validSlots===0;
  }
  function inspect() {
    staged=null;
    if(!targetEmpty())return {ok:false,reason:'destination-occupied'};
    var raw;
    try{raw=config.source.read(key);}catch(error){
      return {ok:false,reason:'source-unreadable'};
    }
    if(typeof raw!=='string'||raw.length===0)
      return {ok:false,reason:'source-missing'};
    if(raw.length>1900000)return {ok:false,reason:'source-oversize'};
    try{
      // Decoders/mappers receive copies so source storage is never mutated.
      var decoded=config.decode(raw);
      var mapped=config.map(JSON.parse(JSON.stringify(decoded)));
      var body=config.engine.serialize(mapped);
      var restored=config.engine.restore(body);
      if(!restored||restored.sequence!==mapped.sequence)
        return {ok:false,reason:'invalid-mapped-state'};
      staged={raw:raw,body:body};
      return {ok:true,reason:null,sequence:restored.sequence};
    }catch(error){return {ok:false,reason:'mapping-failed'};}
  }
  function commit() {
    if(!staged)return {ok:false,reason:'not-staged'};
    var plan=staged;
    staged=null; // Never retry implicitly after an uncertain write.
    if(!targetEmpty())return {ok:false,reason:'destination-occupied'};
    var raw;
    try{raw=config.source.read(key);}catch(error){
      return {ok:false,reason:'source-unreadable'};
    }
    if(raw!==plan.raw)return {ok:false,reason:'source-changed'};
    try{
      var state=config.engine.restore(plan.body);
      if(!state)return {ok:false,reason:'invalid-mapped-state'};
      var result=config.destination.save(state);
      if(!result||result.ok!==true)
        return {ok:false,reason:result&&result.reason||'write-failed'};
      var recovered=config.destination.load&&config.destination.load();
      if(!recovered||config.engine.serialize(recovered)!==plan.body)
        return {ok:false,reason:'verify-failed'};
      return {ok:true,reason:null,sequence:state.sequence};
    }catch(error){return {ok:false,reason:'commit-failed'};}
  }
  return Object.freeze({inspect:inspect,commit:commit});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeSaveImporter;
