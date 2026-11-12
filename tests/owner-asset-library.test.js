const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const cp=require('node:child_process');
const verify=require('../scripts/verify_asset_pack');
const importer=path.join(__dirname,'../scripts/import_owner_asset_archives.py');
function run(args){
 return cp.spawnSync('python3',[importer,...args],{encoding:'utf8'});
}
function temp(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bearframe-owner-'));
 return {root,clean(){fs.rmSync(root,{recursive:true,force:true});}};
}
function exampleArchive(root,invalid){
 const png=fs.readFileSync(path.join(__dirname,
  '../enginehost/fixtures/terrain.png.b64'),'utf8').trim();
 const jpg='/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJkAPCX/2Q==';
 const code=[
  'from zipfile import ZipFile',
  'import sys,base64',
  'root=sys.argv[1]',
  'png=base64.b64decode(sys.argv[2])',
  'jpg=base64.b64decode(sys.argv[4])',
  "if sys.argv[3]=='bad':png=b'bad image'",
  "with ZipFile(root+'/nested.zip','w') as z:",
  " z.writestr('assets/machine.png',png)",
  " z.writestr('refs/Founder.png',jpg)",
  " z.writestr('__MACOSX/._preview.png',b'AppleDouble metadata')",
  " z.writestr('assets/license.txt','game use approved, standalone rules separate')",
  "with ZipFile(root+'/original.zip','w') as z:",
  " z.writestr('Pack Owned.zip',open(root+'/nested.zip','rb').read())",
  " z.writestr('source/frame.png',png)",
  " z.writestr('source/frames.aseprite',b'editable original')"
 ].join('\n');
 const result=cp.spawnSync('python3',['-c',code,root,png,invalid?'bad':'ok',jpg],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 return path.join(root,'original.zip');
}
test('owner-import preserves every source entry and makes ALL PNGs lazy',()=>{
 const t=temp();
 try{
  const src=exampleArchive(t.root,false),dest=path.join(t.root,'packed');
  const r=run([dest,src]);
  assert.equal(r.status,0,r.stderr);
  const info=JSON.parse(r.stdout);
  assert.deepEqual([info.total_source_files,info.runtime_pngs],
    [6,2]);
  const manifest=JSON.parse(fs.readFileSync(path.join(dest,'runtime-pack',
    'asset-manifest.json'),'utf8'));
  assert.equal(Object.keys(manifest.assets).length,3);
  assert.ok(Object.values(manifest.assets).some(a=>a.path.endsWith('.jpg')),
    'mislabeled JPEG reference must be retained without changing bytes');
  assert.ok(Object.values(manifest.assets).every(a=>a.type==='image'&&
    a.preload===false&&a.path.startsWith('library/')));
  const report=verify(path.join(dest,'runtime-pack'));
  assert.equal(report.files,3,'pack must pass independent signature/hash validator');
  const inventory=JSON.parse(fs.readFileSync(
    path.join(dest,'source-inventory.json'),'utf8'));
  assert.equal(inventory.source_entries.length,6);
  assert.equal(inventory.source_entries.filter(x=>x.runtime_id===null).length,3);
  assert.ok(inventory.source_entries.some(x=>x.extension==='aseprite'));
  assert.ok(inventory.source_entries.some(x=>x.extension==='txt'));
  assert.ok(inventory.source_entries.some(x=>x.source_format==='macos-resource-fork'));
  assert.equal(info.runtime_jpegs,1);
  assert.equal(info.runtime_images,3);
  assert.ok(fs.existsSync(src),'original user source must not be mutated/deleted');
  assert.notEqual(run([dest,src]).status,0,'must refuse replacement');
 }finally{t.clean();}
});
test('invalid owner PNG fails closed with no published partial asset pack',()=>{
 const t=temp();
 try{
  const src=exampleArchive(t.root,true),dest=path.join(t.root,'should-not-exist');
  const r=run([dest,src]);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/Invalid PNG signature/);
  assert.equal(fs.existsSync(dest),false);
 }finally{t.clean();}
});
