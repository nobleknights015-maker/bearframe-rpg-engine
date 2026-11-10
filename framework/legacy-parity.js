/* Independent, side-effect-free historical gameplay parity checker.
 * A reversible state mapping is not equivalent to future gameplay behavior:
 * compare the original Rhino step with the new canonical engine step under
 * explicit command translation and compare every historical state field.
 * Does NOT itself authorize migration or a release gate.
 */
function createBearframeLegacyParityProbe(config) {
  if(!config||typeof config.legacyRestore!=='function'||
     typeof config.legacyStep!=='function'||!config.mapper||
     typeof config.mapper.map!=='function'||typeof config.mapper.unmap!=='function'||
     !config.engine||typeof config.engine.step!=='function'||
     typeof config.engine.serialize!=='function')
    throw new TypeError('Original step/restore, mapper, and new engine required');
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function compare(source, oldCommand, newCommand) {
    if(!oldCommand||typeof oldCommand.type!=='string'||
       !newCommand||typeof newCommand.type!=='string')
      return {ok:false,reason:'invalid-command'};
    try{
      var raw=JSON.stringify(source);
      if(!config.legacyRestore(raw))
        return {ok:false,reason:'invalid-source'};
      var base=config.mapper.map(clone(source));
      var oldNext=config.legacyStep(clone(source),clone(oldCommand));
      var oldSerialized=JSON.stringify(oldNext);
      if(!config.legacyRestore(oldSerialized))
        return {ok:false,reason:'invalid-old-transition'};
      var newNext=config.engine.step(base,clone(newCommand));
      if(!newNext||!config.engine.restore(config.engine.serialize(newNext)))
        return {ok:false,reason:'invalid-new-transition'};
      // Mapping's inverse is intentionally limited to imported sequence 0.
      // Reset ONLY the non-semantic journal sequence for parity inspection,
      // never write the comparison state to durable storage.
      var comparable=clone(newNext);
      comparable.sequence=0;
      var recovered=config.mapper.unmap(comparable);
      var equivalent=JSON.stringify(recovered)===oldSerialized;
      var changed=oldSerialized!==raw;
      return {ok:equivalent,reason:equivalent?null:'behavior-mismatch',changed:changed};
    }catch(error){
      return {ok:false,reason:'comparison-failed'};
    }
  }
  function audit(scenarios) {
    if(!Array.isArray(scenarios)||scenarios.length===0)
      return {ok:false,reason:'no-scenarios',checked:0,changed:0};
    var checked=0,changed=0;
    for(var i=0;i<scenarios.length;i++){
      var scenario=scenarios[i];
      if(!scenario||!scenario.state)return {ok:false,reason:'invalid-scenario',checked:checked,changed:changed,index:i};
      var result=compare(scenario.state,scenario.legacyCommand,scenario.targetCommand);
      checked++;
      if(!result.ok)
        return {ok:false,reason:result.reason,checked:checked,changed:changed,index:i};
      if(result.changed)changed++;
    }
    if(changed===0)return {ok:false,reason:'no-changing-scenarios',checked:checked,changed:changed};
    return {ok:true,reason:null,checked:checked,changed:changed};
  }
  return Object.freeze({compare:compare,audit:audit});
}
if(typeof module!=='undefined'&&module.exports)
 module.exports=createBearframeLegacyParityProbe;
