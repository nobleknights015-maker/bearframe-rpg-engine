const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const pack=require('../scripts/package_assets');
const verify=require('../scripts/verify_asset_pack');
const bytes=Buffer.from(fs.readFileSync(path.join(__dirname,'../enginehost/fixtures/terrain.png.b64'),'utf8').trim(),'base64');
const manifest={version:1,assets:{atlas:{type:'atlas',path:'diagnostics/atlas.png',
 width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)}}};
function fixture(run){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bf-pack-verify-')),source=path.join(root,'source'),
  folder=path.join(root,'pack'),install=path.join(root,'installed');
 try{
  fs.mkdirSync(path.join(source,'diagnostics'),{recursive:true});
  fs.writeFileSync(path.join(source,'diagnostics','atlas.png'),bytes);
  pack(manifest,source,folder);
  return run({root,folder,install});
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('verified, signed-by-hash pack installs exactly once without byte changes',()=>fixture(({folder,install})=>{
 assert.deepEqual(verify(folder),{files:1,bytes:bytes.length});
 assert.deepEqual(verify(folder,install),{files:1,bytes:bytes.length});
 assert.deepEqual(fs.readFileSync(path.join(install,'diagnostics','atlas.png')),bytes);
 assert.deepEqual(verify(install),{files:1,bytes:bytes.length});
 assert.throws(()=>verify(folder,install),/overwrite/);
}));
test('modified payload, size or digest fails before installation',()=>fixture(({folder,install})=>{
 const file=path.join(folder,'diagnostics','atlas.png');
 const prior=fs.readFileSync(file);
 fs.writeFileSync(file,Buffer.concat([prior,Buffer.from([42])]));
 assert.throws(()=>verify(folder,install),/changed/);
 assert.equal(fs.existsSync(install),false);
 fs.writeFileSync(file,prior);
 const indexPath=path.join(folder,'asset-index.json'),i=JSON.parse(fs.readFileSync(indexPath));
 i.assets.atlas.sha256='0'.repeat(64);
 fs.writeFileSync(indexPath,JSON.stringify(i));
 assert.throws(()=>verify(folder,install),/hash mismatch/);
 assert.equal(fs.existsSync(install),false);
}));
test('undeclared files, symlink directories and index redirection are rejected',()=>fixture(({folder,install,root})=>{
 fs.writeFileSync(path.join(folder,'undeclared.txt'),'x');
 assert.throws(()=>verify(folder,install),/Undeclared/);
 fs.unlinkSync(path.join(folder,'undeclared.txt'));
 const target=path.join(root,'outside');fs.mkdirSync(target);
 fs.symlinkSync(target,path.join(folder,'link'));
 assert.throws(()=>verify(folder,install),/symbolic link/);
 fs.unlinkSync(path.join(folder,'link'));
 const indexPath=path.join(folder,'asset-index.json'),index=JSON.parse(fs.readFileSync(indexPath));
 index.assets.atlas.path='../secrets';
 fs.writeFileSync(indexPath,JSON.stringify(index));
 assert.throws(()=>verify(folder,install),/inconsistent/);
 assert.equal(fs.existsSync(install),false);
}));
test('Android optional asset pack wiring is guarded and CI verifies real APK contents',()=>{
 const build=fs.readFileSync(path.join(__dirname,'../android/build.sh'),'utf8');
 const ci=fs.readFileSync(path.join(__dirname,'../.github/workflows/engine-ci.yml'),'utf8');
 assert.match(build,/BF_ASSET_PACK_DIR/);
 assert.match(build,/scripts\/verify_asset_pack\.js/);
 assert.match(ci,/Build a deterministic synthetic asset-pack integration fixture/);
 assert.match(ci,/assets\/enginehost\/packs\/active\/asset-index\.json/);
 assert.match(ci,/assets\/enginehost\/packs\/active\/diagnostic\/test\.png/);
});
