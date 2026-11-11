/* Portable browser asset cache adapted from Chris's Engine v1 AssetManager.
 * Source: Plushbound-Legends-mobile/engine-v1-rebuild/engine/src/assets/AssetManager.js
 * Only validated local assets; no direct network, Android or game-world coupling.
 * Async loading is host supplied; this file is for Chromium/WebView and Node.
 */
function createBearframeAssetCache(manifest,loader,options){
  var validate=(typeof module!=='undefined'&&module.exports)?
    require('./asset-manifest.js'):validateBearframeAssets;
  validate(manifest);
  if(typeof loader!=='function')throw new TypeError('Asset loader required');
  options=options||{};
  function bounded(value,min,max,fallback,name){
    if(value===undefined)return fallback;
    if(!Number.isInteger(value)||value<min||value>max)
      throw new RangeError('Invalid asset cache '+name);
    return value;
  }
  var maxEntries=bounded(options.maxEntries,1,4096,128,'maxEntries');
  var maxMemoryBytes=bounded(options.maxMemoryBytes,16384,268435456,33554432,'maxMemoryBytes');
  var source=JSON.parse(JSON.stringify(manifest.assets));
  var cache=new Map(),inflight=new Map(),generation=0;
  var memory=0;
  function descriptor(id) {
    if(!Object.prototype.hasOwnProperty.call(source,id))
      throw new TypeError('Unknown asset '+String(id));
    return JSON.parse(JSON.stringify(source[id]));
  }
  function estimate(d){
    if(d.type==='atlas'||d.type==='image')return d.width*d.height*4;
    return d.bytes||0;
  }
  function validateLoaded(d,value,id){
    if(value==null)throw new TypeError('Asset loader returned no resource '+id);
    if(d.type==='atlas'||d.type==='image'){
      var width=Number.isInteger(value.naturalWidth)?value.naturalWidth:value.width;
      var height=Number.isInteger(value.naturalHeight)?value.naturalHeight:value.height;
      if(!Number.isInteger(width)||!Number.isInteger(height)||
         width!==d.width||height!==d.height)
        throw new TypeError('Asset dimensions mismatch '+id);
      if(typeof value.complete==='boolean'&&!value.complete)
        throw new TypeError('Asset not fully decoded '+id);
    }
  }
  function trim(){
    while(cache.size>maxEntries||memory>maxMemoryBytes){
      var oldest=cache.keys().next().value;
      if(oldest===undefined)break;
      memory-=cache.get(oldest).bytes;cache.delete(oldest);
    }
  }
  function load(id){
    var d=descriptor(id),weight=estimate(d);
    if(weight>maxMemoryBytes)
      return Promise.reject(new RangeError('Asset exceeds memory budget '+id));
    if(cache.has(id)){
      var existing=cache.get(id);cache.delete(id);cache.set(id,existing);
      return Promise.resolve(existing.value);
    }
    if(inflight.has(id))return inflight.get(id).promise;
    var epoch=generation,token={promise:null};
    var pending=Promise.resolve().then(function(){
      return loader(d,id);
    }).then(function(value){
      validateLoaded(d,value,id);
      if(generation===epoch&&inflight.get(id)===token){
        cache.set(id,{value:value,bytes:weight});
        memory+=weight;trim();
      }
      return value;
    }).finally(function(){
      if(inflight.get(id)===token)inflight.delete(id);
    });
    token.promise=pending;inflight.set(id,token);
    return pending;
  }
  function preload(ids){
    var list=ids===undefined?Object.keys(source).filter(function(id){
      return source[id].preload===true;
    }):ids;
    if(!Array.isArray(list)||list.length>4096)throw new TypeError('Invalid preload group');
    var unique=[],seen={};
    list.forEach(function(id){
      descriptor(id);
      if(!Object.prototype.hasOwnProperty.call(seen,id)){
        seen[id]=true;unique.push(id);
      }
    });
    return Promise.all(unique.map(load)).then(function(values){
      var result={};unique.forEach(function(id,index){result[id]=values[index];});
      return result;
    });
  }
  function get(id){
    descriptor(id);
    if(!cache.has(id))return null;
    var value=cache.get(id);cache.delete(id);cache.set(id,value);
    return value.value;
  }
  // Releasing a scene dependency also cancels retention of an in-flight
  // decode. The original caller may receive its value, but cannot repopulate
  // the cache after the scene has relinquished that resource.
  function release(id){
    descriptor(id);
    var pending=inflight.get(id);
    if(pending)inflight.delete(id);
    if(!cache.has(id))return !!pending;
    memory-=cache.get(id).bytes;cache.delete(id);return true;
  }
  // Host-triggered memory pressure: drop least-recently-used decoded assets
  // without invalidating pending loads or mutating the authoritative game state.
  // A zero budget also invalidates pending insertions so they cannot silently
  // refill the cache after a critical low-memory callback.
  function trimTo(targetBytes){
    if(!Number.isInteger(targetBytes)||targetBytes<0||targetBytes>maxMemoryBytes)
      throw new RangeError('Invalid asset cache target');
    if(targetBytes===0){
      var count=cache.size;
      clear();
      return {evicted:count,memoryBytes:0};
    }
    // A noncritical trim is also a memory-pressure boundary: pending decodes
    // started before it must not refill the cache after the host trims it.
    // Callers still receive their decoded result, but it is not retained.
    if(inflight.size){generation++;inflight.clear();}
    var evicted=0;
    while(memory>targetBytes&&cache.size){
      var oldest=cache.keys().next().value;
      memory-=cache.get(oldest).bytes;
      cache.delete(oldest);
      evicted++;
    }
    return {evicted:evicted,memoryBytes:memory};
  }
  function clear(){
    generation++;cache.clear();inflight.clear();memory=0;
  }
  function snapshot(){
    return {registered:Object.keys(source),loaded:Array.from(cache.keys()),
      inflight:Array.from(inflight.keys()),memoryBytes:memory,
      maxMemoryBytes:maxMemoryBytes,maxEntries:maxEntries};
  }
  return Object.freeze({descriptor:descriptor,load:load,preload:preload,get:get,
    release:release,clear:clear,trimTo:trimTo,snapshot:snapshot});
}
if(typeof module!=='undefined'&&module.exports)module.exports=createBearframeAssetCache;
