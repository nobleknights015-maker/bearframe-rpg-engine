const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const pack=require('../scripts/package_assets');
const png=Buffer.from(fs.readFileSync(path.join(__dirname,'../enginehost/fixtures/terrain.png.b64'),'utf8').trim(),'base64');
const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
function sandbox(callback){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bf-pack-test-'));
 const source=path.join(root,'source');fs.mkdirSync(source);const output=path.join(root,'packed');
 try{return callback({root,source,output});}
 finally{fs.rmSync(root,{recursive:true,force:true});}
}
const manifest=(overrides={})=>({version:1,assets:{atlas:{
 type:'atlas',path:'original/atlas.png',width,height,pixelArt:true,preload:true,...overrides
}}});
test('deterministic asset packaging emits the original bytes and matching hash index',()=>sandbox(({source,output,root})=>{
 fs.mkdirSync(path.join(source,'original'));
 fs.writeFileSync(path.join(source,'original/atlas.png'),png);
 const a=pack(manifest(),source,output);
 assert.deepEqual(fs.readFileSync(path.join(output,'original/atlas.png')),png);
 assert.equal(a.assets.atlas.sha256,crypto.createHash('sha256').update(png).digest('hex'));
 assert.equal(a.assets.atlas.bytes,png.length);
 assert.equal(JSON.parse(fs.readFileSync(path.join(output,'asset-manifest.json'),'utf8')).version,1);
 const another=path.join(root,'another'),b=pack(manifest(),source,another);
 assert.deepEqual(a,b);
 assert.equal(fs.readFileSync(path.join(output,'asset-index.json'),'utf8'),
  fs.readFileSync(path.join(another,'asset-index.json'),'utf8'));
}));
test('broken signatures, mismatched dimensions and byte budgets fail without an output',()=>sandbox(({source,output})=>{
 fs.mkdirSync(path.join(source,'original'));
 const file=path.join(source,'original/atlas.png');
 fs.writeFileSync(file,Buffer.from('not an image'));
 assert.throws(()=>pack(manifest(),source,output),/signature/);
 assert.equal(fs.existsSync(output),false);
 fs.writeFileSync(file,png);
 assert.throws(()=>pack(manifest({width:width+1}),source,output),/signature/);
 assert.throws(()=>pack(manifest({bytes:1}),source,output),/budget/);
 assert.equal(fs.existsSync(output),false);
}));
test('path traversal, symlink escape and overwrite are refused',()=>sandbox(({root,source,output})=>{
 fs.mkdirSync(path.join(source,'original'));
 fs.writeFileSync(path.join(source,'original/atlas.png'),png);
 assert.throws(()=>pack(manifest({path:'../escape.png'}),source,output),/descriptor/);
 const other=path.join(root,'elsewhere.png');fs.writeFileSync(other,png);
 fs.symlinkSync(other,path.join(source,'original/link.png'));
 assert.throws(()=>pack(manifest({path:'original/link.png'}),source,output),/Symbolic link/);
 assert.equal(fs.existsSync(output),false);
 pack(manifest(),source,output);
 assert.throws(()=>pack(manifest(),source,output),/overwrite/);
 assert.deepEqual(fs.readFileSync(path.join(output,'original/atlas.png')),png);
}));
test('manifest rejects invalid descriptor types and duplicate source paths',()=>sandbox(({source,output})=>{
 assert.throws(()=>pack({version:1,assets:{a:{type:'music',path:'a.png'}}},source,output),/Incompatible/);
 assert.throws(()=>pack({version:1,assets:{
  a:{type:'image',path:'same.png',width:1,height:1},
  b:{type:'image',path:'same.png',width:1,height:1}
 }},source,output),/Duplicate asset path/);
 assert.equal(fs.existsSync(output),false);
}));
