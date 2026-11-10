/* Port of version-chain migration contract from Chris's Plushbound Engine v1 SaveManager.
 * https://github.com/nobleknights015-maker/Plushbound-Legends-mobile/blob/engine-v1-rebuild/engine/src/saves/SaveManager.js
 * Applies only to engine-owned project data: no Plushbound fields or game content.
 * Portable synchronous migration; caller must journal/commit result separately.
 */
function createBearframeSaveMigrator(config){
  config=config||{};
  var current=config.schemaVersion;
  if(!Number.isInteger(current)||current<1||current>1000)
    throw new TypeError('Positive schemaVersion required');
  var steps=config.migrations||{};
  var validate=typeof config.validate==='function'?config.validate:function(x){return !!x;};
  var has=Object.prototype.hasOwnProperty;
  function clone(x){return JSON.parse(JSON.stringify(x));}
  function canMigrate(version){
    var n=Number(version);
    if(!Number.isInteger(n)||n<1||n>current)return false;
    while(n<current) {
      if(!has.call(steps,n)||typeof steps[n]!=='function')return false;
      n++;
    }
    return true;
  }
  function migrate(payload){
    if(!payload||typeof payload!=='object'||Array.isArray(payload)||
       !payload.state||typeof payload.state!=='object')
      throw new TypeError('Invalid save payload');
    var version=Number(payload.schemaVersion);
    if(!canMigrate(version))
      throw new TypeError('Unsupported save schema '+payload.schemaVersion);
    var original=version,working=clone(payload),id=payload.project||null;
    while(version<current){
      var migrated=steps[version](clone(working));
      if(!migrated||typeof migrated!=='object'||Array.isArray(migrated)||
         !migrated.state||typeof migrated.state!=='object')
        throw new TypeError('Migration '+version+' -> '+(version+1)+' returned invalid payload');
      if(id!==null&&migrated.project!==id)
        throw new TypeError('Migration cannot change owning project');
      working=clone(migrated);
      version++;
      working.schemaVersion=version;
    }
    if(!validate(working.state))
      throw new TypeError('Migrated save failed state validation');
    if(original!==current)working.migratedFrom=original;
    return working;
  }
  return Object.freeze({schemaVersion:current,canMigrate:canMigrate,migrate:migrate});
}
if(typeof module!=='undefined'&&module.exports)module.exports=createBearframeSaveMigrator;
