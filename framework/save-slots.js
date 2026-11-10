/* Bearframe Engine Kit: synchronous, crash-resistant two-slot save journal.
 * Adapter contract: read(key) -> string|null, write(key,string) -> boolean.
 * A caller MUST render a new state only after save(state).ok === true.
 * Do not use async fire-and-forget storage for durable state.
 */
function createBearframeSaveSlots(engine,storage,prefix){
  if(!engine||typeof engine.restore!=='function'||typeof engine.serialize!=='function')
    throw new TypeError('Engine with restore/serialize required');
  if(!storage||typeof storage.read!=='function'||typeof storage.write!=='function')
    throw new TypeError('Synchronous storage adapter required');
  prefix=prefix||('bf:'+engine.projectId+':v'+engine.version);
  if(typeof prefix!=='string'||prefix.length>150)throw new TypeError('Invalid save namespace');
  var A=prefix+':a',B=prefix+':b';
  function hash(str){
    var h=2166136261;
    for(var i=0;i<str.length;i++){
      h^=str.charCodeAt(i);
      h=(h+((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24)))>>>0;
    }
    return ('00000000'+h.toString(16)).slice(-8);
  }
  function parse(raw,slot){
    if(typeof raw!=='string'||raw.length<30||raw.length>2000000)return null;
    try {
      var e=JSON.parse(raw);
      if(!e||e.format!==1||e.project!==engine.projectId||e.version!==engine.version||
        !Number.isInteger(e.sequence)||e.sequence<0||
        typeof e.body!=='string'||typeof e.checksum!=='string'||e.checksum!==hash(e.body))return null;
      var state=engine.restore(e.body);
      if(!state||state.sequence!==e.sequence)return null;
      return {slot:slot,state:state,raw:raw,body:e.body,sequence:e.sequence};
    }catch(error){return null;}
  }
  function readSlot(key){
    try{return parse(storage.read(key),key);}catch(error){return null;}
  }
  function latest(){
    var a=readSlot(A),b=readSlot(B);
    if(!a)return b;if(!b)return a;
    if(a.sequence===b.sequence){
      // Two distinct payloads with identical revisions are an ambiguous fork.
      if(a.body!==b.body)return {conflict:true};
      return a;
    }
    return a.sequence>b.sequence?a:b;
  }
  function load(){
    var selected=latest();
    return selected&&!selected.conflict?selected.state:null;
  }
  function save(state){
    var serialized;
    try{serialized=engine.serialize(state);}catch(error){return {ok:false,reason:'invalid-state'};}
    if(serialized.length>1900000)return {ok:false,reason:'oversize'};
    var prev=latest();
    if(prev&&prev.conflict)return {ok:false,reason:'conflict'};
    if(prev&&state.sequence<prev.sequence)return {ok:false,reason:'stale'};
    if(prev&&state.sequence===prev.sequence)
      return prev.body===serialized?{ok:true,slot:prev.slot,unchanged:true}:{ok:false,reason:'conflict'};
    var target=prev&&prev.slot===A?B:A;
    var raw=JSON.stringify({format:1,project:engine.projectId,version:engine.version,
      sequence:state.sequence,checksum:hash(serialized),body:serialized});
    try{
      if(storage.write(target,raw)!==true)return {ok:false,reason:'write-failed'};
    }catch(error){return {ok:false,reason:'write-failed'};}
    var verified=readSlot(target);
    if(!verified||verified.body!==serialized||verified.sequence!==state.sequence)
      return {ok:false,reason:'verify-failed'};
    return {ok:true,slot:target,unchanged:false};
  }
  function occupied(key){
    try {var raw=storage.read(key);return typeof raw==='string'&&raw.length>0;}
    catch(error){return true;} // Fail closed when storage is unreadable.
  }
  function health(){
    var a=readSlot(A),b=readSlot(B),newest=latest();
    return {validSlots:(a?1:0)+(b?1:0),occupiedSlots:(occupied(A)?1:0)+(occupied(B)?1:0),
      latestSequence:newest&&!newest.conflict?newest.sequence:null,
      conflict:!!(newest&&newest.conflict)};
  }
  return Object.freeze({load:load,save:save,health:health,keys:Object.freeze([A,B])});
}
if(typeof module!=='undefined'&&module.exports)module.exports=createBearframeSaveSlots;
