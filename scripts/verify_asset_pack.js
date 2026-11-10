#!/usr/bin/env node
'use strict';
/* Validate a finished original-asset pack, then optionally install it.
 * Fail closed before copying any files. No remote URLs, project/game data,
 * or runtime state changes. Every payload is independently rehashed.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const validateManifest=require('../framework/asset-manifest');
const checkSignature=require('./package_assets').validSignature;
const own=Object.prototype.hasOwnProperty;
const PACKAGE_LIMIT=512*1024*1024;
function isRecord(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
function readJSON(file){
 const s=fs.statSync(file);
 if(!s.isFile()||s.size>4*1024*1024)throw Error('Invalid asset pack metadata');
 return JSON.parse(fs.readFileSync(file,'utf8'));
}
function checkTree(folder,relative,allowed,observed){
 for(const name of fs.readdirSync(folder).sort()){
  const file=path.join(folder,name),next=relative?relative+'/'+name:name;
  const stat=fs.lstatSync(file);
  if(stat.isSymbolicLink())throw Error('Asset pack contains symbolic link: '+next);
  if(stat.isDirectory())checkTree(file,next,allowed,observed);
  else if(stat.isFile()){
   if(!allowed.has(next))throw Error('Undeclared asset pack file: '+next);
   observed.add(next);
  }else throw Error('Unsupported asset pack entry: '+next);
 }
}
function verifyAssetPack(packageDir,targetDir){
 if(typeof packageDir!=='string'||!packageDir)
  throw new TypeError('Asset pack directory required');
 const source=path.resolve(packageDir);
 if(fs.lstatSync(source).isSymbolicLink()||!fs.statSync(source).isDirectory())
  throw Error('Asset pack must be a regular directory');
 const manifest=readJSON(path.join(source,'asset-manifest.json'));
 const index=readJSON(path.join(source,'asset-index.json'));
 validateManifest(manifest);
 if(!isRecord(index)||index.version!==1||!isRecord(index.assets))
  throw Error('Invalid asset index schema');
 const ids=Object.keys(manifest.assets).sort();
 const indexIds=Object.keys(index.assets).sort();
 if(JSON.stringify(ids)!==JSON.stringify(indexIds))
  throw Error('Asset index entries differ from manifest');
 const declared=new Set(['asset-manifest.json','asset-index.json']);
 const payloads=[];
 let total=0;
 for(const id of ids){
  const d=manifest.assets[id],record=index.assets[id];
  if(!isRecord(record)||Object.keys(record).length!==3||
     !own.call(record,'bytes')||!own.call(record,'path')||!own.call(record,'sha256')||
     record.path!==d.path||
     !Number.isInteger(record.bytes)||record.bytes<1||record.bytes>128*1024*1024||
     typeof record.sha256!=='string'||!/^[a-f0-9]{64}$/.test(record.sha256))
     throw Error('Invalid or inconsistent asset index: '+id);
  if(d.bytes!==undefined&&record.bytes>d.bytes)
   throw Error('Asset exceeds declared byte budget: '+id);
  total+=record.bytes;
  if(total>PACKAGE_LIMIT)throw Error('Asset pack exceeds 512 MiB');
  const file=path.join(source,...record.path.split('/'));
  const stat=fs.lstatSync(file);
  if(stat.isSymbolicLink()||!stat.isFile()||stat.size!==record.bytes)
   throw Error('Asset missing, linked or changed: '+id);
  const bytes=fs.readFileSync(file);
  const sha=crypto.createHash('sha256').update(bytes).digest('hex');
  if(bytes.length!==record.bytes||sha!==record.sha256)
   throw Error('Asset hash mismatch: '+id);
  const ext=record.path.split('.').pop();
  if(!checkSignature(bytes,d.type,ext,d.width,d.height))
   throw Error('Asset signature mismatch: '+id);
  declared.add(record.path);
  payloads.push({path:record.path,bytes});
 }
 const observed=new Set();
 checkTree(source,'',declared,observed);
 if(observed.size!==declared.size)
  throw Error('Incomplete asset package');
 if(targetDir!==undefined){
  if(typeof targetDir!=='string'||!targetDir)
   throw new TypeError('Target directory required');
  const target=path.resolve(targetDir);
  if(target===source||target.startsWith(source+path.sep))
   throw Error('Cannot install pack inside itself');
  if(fs.existsSync(target))
   throw Error('Refusing to overwrite installed asset pack');
  const parent=path.dirname(target);
  fs.mkdirSync(parent,{recursive:true});
  const stage=fs.mkdtempSync(path.join(parent,'.bf-pack-install-'));
  try{
   for(const record of payloads){
    const output=path.join(stage,...record.path.split('/'));
    fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.writeFileSync(output,record.bytes,{flag:'wx'});
   }
   for(const name of ['asset-manifest.json','asset-index.json']){
    fs.copyFileSync(path.join(source,name),path.join(stage,name),
     fs.constants.COPYFILE_EXCL);
   }
   if(fs.existsSync(target))throw Error('Target appeared during installation');
   fs.renameSync(stage,target);
  }catch(error){fs.rmSync(stage,{recursive:true,force:true});throw error;}
 }
 return {files:ids.length,bytes:total};
}
module.exports=verifyAssetPack;
if(require.main===module){
 const args=process.argv.slice(2);
 if(args.length<1||args.length>2){
  console.error('Usage: node scripts/verify_asset_pack.js PACK_DIR [NEW_INSTALL_DIR]');
  process.exitCode=2;
 }else{
  try{
   const result=verifyAssetPack(args[0],args[1]);
   console.log('Verified '+result.files+' packaged asset(s), '+result.bytes+' bytes');
  }catch(error){
   console.error('Asset pack verification failed: '+error.message);
   process.exitCode=1;
  }
 }
}
