/* Optional content binding for new project journals. Deliberately absent for
 * historical unversioned projects. Not cryptographic/authentication.
 * Canonical object-key ordering makes the tag cross-JS-engine deterministic.
 */
function createBearframeContentContract(project){
  if(!project||project.contentRevision===undefined)return null;
  if(typeof project.contentRevision!=='string'||
     !/^[a-z][a-z0-9_-]{0,63}$/.test(project.contentRevision))
    throw new TypeError('Invalid project contentRevision');
  function canonical(v){
    if(v===null||typeof v!=='object')return JSON.stringify(v);
    if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
    var keys=Object.keys(v).sort(),bits=[];
    for(var i=0;i<keys.length;i++){
      var k=keys[i];
      if(v[k]!==undefined)bits.push(JSON.stringify(k)+':'+canonical(v[k]));
    }
    return '{'+bits.join(',')+'}';
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
