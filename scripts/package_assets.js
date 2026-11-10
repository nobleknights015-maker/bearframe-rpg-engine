#!/usr/bin/env node
'use strict';
/* Deterministic original-asset packaging utility; no game content or network.
 * Validates the versioned runtime manifest, local paths, size limits and file
 * signatures, and commits output only after every file validates.
 * Images are still decoded/dimension-checked by the runtime's actual loader.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const validate=require('../framework/asset-manifest');
const IMAGE_LIMIT=64*1024*1024,AUDIO_LIMIT=128*1024*1024;
const PACKAGE_LIMIT=512*1024*1024;
function validSignature(bytes,type,ext,width,height){
 if(ext==='png'){
  return bytes.length>=33 &&
    bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) &&
    bytes.toString('ascii',12,16)==='IHDR' &&
    bytes.readUInt32BE(16)===width&&bytes.readUInt32BE(20)===height;
 }
 if(ext==='webp')return bytes.length>=16&&
   bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(ext==='jpg'||ext==='jpeg')return bytes.length>=4&&
   bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 if(ext==='ogg')return bytes.length>=4&&bytes.toString('ascii',0,4)==='OggS';
 if(ext==='wav')return bytes.length>=44&&
   bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE';
 if(ext==='mp3')return bytes.length>=4&&
   (bytes.toString('ascii',0,3)==='ID3'||(bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0));
 return false;
}
function packageAssets(manifest,sourceDir,targetDir){
 validate(manifest);
 if(!sourceDir||!targetDir)throw new TypeError('Source and output directory required');
 const source=fs.realpathSync(sourceDir),target=path.resolve(targetDir);
 if(fs.existsSync(target))throw new Error('Refusing to overwrite existing asset pack');
 if(target===source||target.startsWith(source+path.sep))
  throw new Error('Output must be outside the source asset directory');
 const ids=Object.keys(manifest.assets).sort();
 const files=[],index={version:1,assets:{}};
 let total=0;
 for(const id of ids){
  const d=manifest.assets[id],parts=d.path.split('/');
  let node=source;
  for(const part of parts){
   node=path.join(node,part);
   const stat=fs.lstatSync(node);
   if(stat.isSymbolicLink())throw new Error('Symbolic link is forbidden for '+id);
  }
  const absolute=path.resolve(source,d.path);
  if(!absolute.startsWith(source+path.sep)||!fs.statSync(absolute).isFile())
   throw new Error('Unsafe asset file '+id);
  const size=fs.statSync(absolute).size;
  const limit=d.type==='atlas'||d.type==='image'?IMAGE_LIMIT:AUDIO_LIMIT;
  if(size<1||size>limit||(d.bytes!==undefined&&size>d.bytes))
   throw new Error('Asset byte budget exceeded for '+id);
  total+=size;
  if(total>PACKAGE_LIMIT)throw new Error('Asset pack exceeds 512 MiB limit');
  const bytes=fs.readFileSync(absolute);
  if(bytes.length!==size)throw new Error('Asset changed during packaging: '+id);
  const ext=d.path.split('.').pop();
  if(!validSignature(bytes,d.type,ext,d.width,d.height))
   throw new Error('Asset signature or PNG dimensions mismatch for '+id);
  const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  files.push({path:d.path,bytes:bytes});
  index.assets[id]={path:d.path,bytes:size,sha256:sha256};
 }
 const parent=path.dirname(target);
 fs.mkdirSync(parent,{recursive:true});
 const stage=fs.mkdtempSync(path.join(parent,'.bearframe-assets-'));
 try{
  for(const file of files){
   const destination=path.join(stage,file.path);
   fs.mkdirSync(path.dirname(destination),{recursive:true});
   fs.writeFileSync(destination,file.bytes,{flag:'wx'});
  }
  const ordered={version:1,assets:{}};
  for(const id of ids)ordered.assets[id]=manifest.assets[id];
  fs.writeFileSync(path.join(stage,'asset-manifest.json'),
   JSON.stringify(ordered,null,2)+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(stage,'asset-index.json'),
   JSON.stringify(index,null,2)+'\n',{flag:'wx'});
  if(fs.existsSync(target))throw new Error('Output appeared during packaging');
  fs.renameSync(stage,target);
 }catch(error){fs.rmSync(stage,{recursive:true,force:true});throw error;}
 return index;
}
module.exports=packageAssets;
if(require.main===module){
 if(process.argv.length!==5){
  console.error('Usage: node scripts/package_assets.js MANIFEST.json SOURCE_DIR OUTPUT_DIR');
  process.exitCode=2;
 }else{
  try{
   const manifest=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
   const result=packageAssets(manifest,process.argv[3],process.argv[4]);
   console.log('Packaged '+Object.keys(result.assets).length+' verified asset(s)');
  }catch(error){console.error('Asset packaging failed: '+error.message);process.exitCode=1;}
 }
}
