/* Explicit historical v1 -> compatible portable project migration coordinator.
 * A verified byte-identical recovery vault must exist BEFORE any target journal
 * write. Neither conversion nor rollback writes the original legacy source.
 * Requires a reviewed complete target mapping and original restore validator.
 */
function createBearframeLegacyMigration(config){
  if(!config||!config.source||!config.storage||!config.engine||
    !config.mapping||typeof config.legacyRestore!=='function'||
    typeof config.verifyGameplayParity!=='function'||
    typeof config.targetPrefix!=='string'||
    !/^bf:[a-z][a-z0-9_-]{0,63}:v[1-9][0-9]{0,3}(?::[a-z][a-z0-9_-]{0,63})?$/.test(config.targetPrefix))
    throw new TypeError('Explicit original restore, mapping and target namespace required');
  var node=(typeof module!=='undefined'&&module.exports);
  var archiveFactory=node?require('./legacy-archive.js'):createBearframeLegacyArchive;
  var mapperFactory=node?require('./legacy-v1-mapper.js'):createBearframeLegacyV1Mapper;
  var journalFactory=node?require('./save-slots.js'):createBearframeSaveSlots;
  var importerFactory=node?require('./save-import.js'):createBearframeSaveImporter;
  var legacy=node?require('./legacy-save-v1.js'):BearframeLegacyV1;
  var vault=archiveFactory(config.source,config.storage);
  var mapped=mapperFactory({engine:config.engine,mapping:config.mapping,
    legacyRestore:config.legacyRestore});
  var journal=journalFactory(config.engine,config.storage,config.targetPrefix);
  var imported=importerFactory({source:config.source,sourceKey:'expedition',
    destination:journal,engine:config.engine,
    decode:legacy.decode,map:mapped.map});
  var stagedRaw=null;
  function matchingArchive(){
    var state=vault.audit();
    if(!state.ok)return {ok:false,reason:'backup-missing-or-invalid'};
    if(!state.sourceMatches)return {ok:false,reason:'backup-source-diverged'};
    var copy=vault.exactCopy();
    if(!copy.ok)return {ok:false,reason:'backup-unreadable'};
    return {ok:true,raw:copy.raw};
  }
  function preflight(){
    stagedRaw=null;
    var safe=matchingArchive();
    if(!safe.ok)return safe;
    // A data round-trip is not proof that future events and combat behave
    // the same. A verified project-specific parity check must explicitly pass.
    // Without it, the original launcher remains the sole playable option.
    try{
      var sourceState=legacy.decode(safe.raw);
      var targetState=mapped.map(sourceState);
      if(config.verifyGameplayParity(sourceState,targetState)!==true)
        return {ok:false,reason:'behavior-incompatible'};
    }catch(error){return {ok:false,reason:'behavior-incompatible'};}
    var result=imported.inspect();
    if(!result.ok)return result;
    stagedRaw=safe.raw;
    return {ok:true,reason:null,sequence:result.sequence};
  }
  function commit(){
    if(stagedRaw===null)return {ok:false,reason:'not-staged'};
    var expected=stagedRaw;stagedRaw=null;
    var safe=matchingArchive();
    if(!safe.ok)return safe;
    if(safe.raw!==expected)return {ok:false,reason:'backup-changed'};
    var result=imported.commit();
    if(!result.ok)return result;
    var saved=journal.load();
    if(!saved||saved.sequence!==0)return {ok:false,reason:'target-verify-failed'};
    try{
      var original=mapped.unmap(saved);
      if(JSON.stringify(legacy.decode(expected))!==JSON.stringify(original))
        return {ok:false,reason:'round-trip-mismatch'};
    }catch(error){return {ok:false,reason:'round-trip-mismatch'};}
    return {ok:true,reason:null,sequence:saved.sequence};
  }
  function status(){
    var h=journal.health(),copy=vault.audit();
    return {backup:copy.ok?copy.sourceMatches?'matches':'source-diverged':'missing-or-invalid',
      destination:h.occupiedSlots===0?'empty':h.validSlots>0?'populated':'unreadable',
      conflict:h.conflict};
  }
  // Safe rollback is to continue using the unchanged original launcher.
  // The archive remains retrievable even if that original later advances.
  return Object.freeze({preflight:preflight,commit:commit,status:status,
    archivedOriginal:vault.exactCopy});
}
if(typeof module!=='undefined'&&module.exports)
 module.exports=createBearframeLegacyMigration;
