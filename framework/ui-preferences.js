/* Bearframe display/audio preferences, independent from gameplay saves.
 * Uses the same crash-resistant two-slot journal as the engine, but a wholly
 * disjoint namespace. Corrupt settings never replace player progress.
 */
function createBearframeUiPreferences(storage,projectId){
  var node=typeof module!=='undefined'&&module.exports;
  var Slots=node?require('./save-slots.js'):createBearframeSaveSlots;
  if(!storage||typeof storage.read!=='function'||typeof storage.write!=='function'||
     typeof projectId!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/.test(projectId))
    throw new TypeError('UI preferences require storage and stable project ID');
  var names=['showPad','reducedMotion','muted'];
  var buses=['master','music','sfx'];
  function copy(v){return JSON.parse(JSON.stringify(v));}
  function fresh(){return {version:1,sequence:0,showPad:true,
    reducedMotion:false,muted:false,
    volumes:{master:100,music:80,sfx:100}};}
  function valid(v){
    if(!v||typeof v!=='object'||Array.isArray(v)||
       Object.keys(v).sort().join(',')!==
         'muted,reducedMotion,sequence,showPad,version,volumes'||
       v.version!==1||!Number.isInteger(v.sequence)||
       v.sequence<0||v.sequence>2147483640||
       names.some(function(k){return typeof v[k]!=='boolean';})||
       !v.volumes||typeof v.volumes!=='object'||Array.isArray(v.volumes)||
       Object.keys(v.volumes).sort().join(',')!=='master,music,sfx'||
       buses.some(function(k){
         return !Number.isInteger(v.volumes[k])||
           v.volumes[k]<0||v.volumes[k]>100;
       }))return false;
    return true;
  }
  var adapter={projectId:'ui_'+projectId,version:1,
    restore:function(raw){
      try{var v=typeof raw==='string'?JSON.parse(raw):copy(raw);
        return valid(v)?v:null;
      }catch(error){return null;}
    },
    serialize:function(v){
      if(!valid(v))throw new TypeError('Invalid UI preference state');
      return JSON.stringify(v);
    }};
  // Native WebView SharedPreferences accepts bf:<project>:v<version>:<kind>:a/b.
  // Keep settings in a distinct version/type namespace without expanding
  // the native bridge's strict key allowlist or touching RPG save keys.
  var journal=Slots(adapter,storage,'bf:'+projectId+':v1:ui');
  var current=journal.load()||fresh();
  function snapshot(){return copy(current);}
  function commit(next){
    if(!valid(next))return {ok:false,reason:'invalid-state'};
    var health=journal.health();
    if(health.conflict||health.contentMismatch||
       (health.occupiedSlots>0&&health.validSlots===0))
      return {ok:false,reason:'corrupt-settings'};
    if(next.sequence!==current.sequence+1)
      return {ok:false,reason:'invalid-sequence'};
    var result=journal.save(next);
    if(!result.ok)return result;
    current=copy(next);
    return {ok:true,sequence:current.sequence,state:snapshot()};
  }
  function set(name,value){
    if(names.indexOf(name)<0||typeof value!=='boolean')
      return {ok:false,reason:'invalid-setting'};
    if(current[name]===value)
      return {ok:true,unchanged:true,sequence:current.sequence,state:snapshot()};
    var next=snapshot();next[name]=value;next.sequence++;
    return commit(next);
  }
  function volume(bus,value){
    if(buses.indexOf(bus)<0||!Number.isInteger(value)||
       value<0||value>100)
      return {ok:false,reason:'invalid-setting'};
    if(current.volumes[bus]===value)
      return {ok:true,unchanged:true,sequence:current.sequence,state:snapshot()};
    var next=snapshot();next.volumes[bus]=value;next.sequence++;
    return commit(next);
  }
  function reload(){
    // Only use on explicit restore/recreate, never drop uncommitted edits.
    var loaded=journal.load();
    if(loaded)current=loaded;
    return snapshot();
  }
  return Object.freeze({snapshot:snapshot,set:set,volume:volume,
    reload:reload,health:function(){return journal.health();},
    keys:journal.keys});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeUiPreferences;
