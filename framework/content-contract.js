/* Optional content binding for new project journals. Deliberately absent for
 * historical unversioned projects. Not cryptographic/authentication.
 * Canonical object-key ordering makes the tag cross-JS-engine deterministic.
 */
function createBearframeContentContract(project){
  if(!project||project.contentRevision===undefined)return null;
  if(typeof project.contentRevision!=='string'||
     !/^[a-z][a-z0-9_-]{0,63}$/.test(project.contentRevision))
    throw new TypeError('Invalid project contentRevision');
  // Reject values that JSON would silently erase or coerce. Otherwise two
  // different authored contracts could share the same journal fingerprint.
  var active=[];
  function canonical(v){
    if(v===null)return 'null';
    if(typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);
    if(typeof v==='number'){
      if(!Number.isFinite(v))throw new TypeError('Invalid content contract number');
      return JSON.stringify(v);
    }
    if(typeof v!=='object')throw new TypeError('Unsupported content contract value');
    if(active.indexOf(v)!==-1)throw new TypeError('Cyclic content contract');
    if(!Array.isArray(v)&&Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null)
      throw new TypeError('Unsupported content contract object');
    // Accessors can execute code or return changing values while hashing.
    // Symbol keys are omitted by Object.keys, so reject both explicitly.
    if(Object.getOwnPropertySymbols(v).length)
      throw new TypeError('Unsupported content contract symbol property');
    var descriptors=Object.getOwnPropertyDescriptors(v);
    var descriptorKeys=Object.keys(descriptors);
    for(var d=0;d<descriptorKeys.length;d++){
      var descriptor=descriptors[descriptorKeys[d]];
      if(!Object.prototype.hasOwnProperty.call(descriptor,'value'))
        throw new TypeError('Unsupported content contract accessor property');
    }
    active.push(v);
    try{
      if(Array.isArray(v)){
        // Non-index properties would otherwise be omitted from the fingerprint.
        var own=Object.keys(v);
        for(var a=0;a<own.length;a++){
          if(!/^(0|[1-9][0-9]*)$/.test(own[a])||Number(own[a])>=v.length)
            throw new TypeError('Unsupported content contract array property');
        }
        var values=[];
        for(var j=0;j<v.length;j++){
          if(!Object.prototype.hasOwnProperty.call(v,j))throw new TypeError('Sparse content contract array');
          values.push(canonical(v[j]));
        }
        return '['+values.join(',')+']';
      }
      var keys=Object.keys(v).sort(),bits=[];
      for(var i=0;i<keys.length;i++){
        var k=keys[i];
        bits.push(JSON.stringify(k)+':'+canonical(v[k]));
      }
      return '{'+bits.join(',')+'}';
    }finally{active.pop();}
  }
  var data=canonical(project),fnv=2166136261,djb=5381;
  for(var n=0;n<data.length;n++){
    var ch=data.charCodeAt(n);
    fnv^=ch;
    fnv=(fnv+((fnv<<1)+(fnv<<4)+(fnv<<7)+(fnv<<8)+(fnv<<24)))>>>0;
    djb=(((djb<<5)+djb)^ch)>>>0;
  }
  function hex(n){return ('00000000'+(n>>>0).toString(16)).slice(-8);}
  return 'v1:'+project.contentRevision+':'+hex(fnv)+hex(djb);
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeContentContract;
