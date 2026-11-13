#!/usr/bin/env node
/* Install a private, user-authorized local sound bank in a non-release APK.
 * No source audio bytes or owner audio paths are committed to GitHub.
 * Runtime gets a data-only catalog whose packaged files were verified here.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function fail(s){throw new Error(s);}
function record(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
const ids=/^[a-z][a-z0-9_-]{0,63}$/;
const clipPath=/^audio\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(ogg|wav|mp3)$/;
function install(profileFile,sourceDirectory,destination){
  if(!profileFile||!sourceDirectory||!destination)
    fail('Usage: install_game_audio_profile.js PROFILE.json SOURCE_DIRECTORY APK_ASSET_ROOT');
  const profileStat=fs.lstatSync(profileFile);
  if(!profileStat.isFile()||profileStat.isSymbolicLink()||profileStat.size>1000000)
    fail('Sound profile must be a small regular JSON file');
  const profile=JSON.parse(fs.readFileSync(profileFile,'utf8'));
  if(!record(profile)||profile.version!==1||!record(profile.catalog)||
     !record(profile.cues)||!record(profile.music))
    fail('Sound profile must declare version, catalog, cues and music');
  const allowed=['version','catalog','cues','music'];
  for(const k of Object.keys(profile))if(!allowed.includes(k))
    fail('Unknown sound profile field '+k);
  const entries=Object.entries(profile.catalog);
  if(!entries.length||entries.length>256)fail('Sound catalog size out of range');
  const seen=new Set(),manifest={version:1,files:[]},root=path.resolve(sourceDirectory);
  if(!fs.lstatSync(root).isDirectory())fail('Audio source directory required');
  let total=0;
  for(const [id,clip] of entries){
    if(!ids.test(id)||!record(clip)||!['music','sfx'].includes(clip.type)||
       typeof clip.path!=='string'||!clipPath.test(clip.path)||
       !Object.keys(clip).every(k=>['type','path','loop'].includes(k))||
       (clip.loop!==undefined&&typeof clip.loop!=='boolean')||
       (clip.type==='sfx'&&clip.loop===true))
      fail('Invalid sound catalog item '+id);
    if(seen.has(clip.path))fail('Duplicate sound asset '+clip.path);
    seen.add(clip.path);
    const relative=clip.path.split('/');
    let next=root;
    // Reject symbolic links in all source path components, not just files.
    for(const component of relative){
      next=path.join(next,component);
      const stat=fs.lstatSync(next);
      if(stat.isSymbolicLink())fail('Symlink in owner sound bank: '+clip.path);
    }
    const fileStat=fs.statSync(next);
    if(!fileStat.isFile()||fileStat.size<32||fileStat.size>64*1024*1024)
      fail('Audio file is absent, empty or too large: '+clip.path);
    const bytes=fs.readFileSync(next),digest=crypto.createHash('sha256')
      .update(bytes).digest('hex');
    total+=bytes.length;
    if(total>256*1024*1024)fail('Audio bank exceeds 256 MB');
    const output=path.join(destination,...relative);
    fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.writeFileSync(output,bytes,{flag:'wx'});
    if(crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex')!==digest)
      fail('Packaged audio failed exact-byte readback: '+clip.path);
    manifest.files.push({id,path:clip.path,type:clip.type,bytes:bytes.length,sha256:digest});
  }
  for(const [key,id] of Object.entries(profile.cues)){
    if(!['menu_open','menu_close','menu_select','step','door','event','battle_start',
      'battle_round','battle_end','item','save'].includes(key)||
       !Object.prototype.hasOwnProperty.call(profile.catalog,id)||
       profile.catalog[id].type!=='sfx')
      fail('Invalid sound cue '+key);
  }
  if(!record(profile.music.maps))fail('Soundtrack map bindings required');
  for(const key of Object.keys(profile.music)){
    if(!['default','battle','maps'].includes(key))
      fail('Unknown soundtrack field '+key);
  }
  for(const key of ['default','battle']){
    const id=profile.music[key];
    if(id!==undefined&&id!==null&&
      (!Object.prototype.hasOwnProperty.call(profile.catalog,id)||
       profile.catalog[id].type!=='music'))fail('Invalid soundtrack '+key);
  }
  for(const [map,id] of Object.entries(profile.music.maps)){
    if(!ids.test(map)||!Object.prototype.hasOwnProperty.call(profile.catalog,id)||
       profile.catalog[id].type!=='music')
      fail('Invalid area soundtrack '+map);
  }
  // Store only IDs and local paths; no creator filesystem paths appear in APK.
  const js='var BEARFRAME_GAME_AUDIO_PROFILE = '+
    JSON.stringify(profile)+';\n';
  fs.writeFileSync(path.join(destination,'audio-profile.js'),js);
  fs.writeFileSync(path.join(destination,'game-audio-manifest.json'),
    JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
if(require.main===module){
  try{const out=install(process.argv[2],process.argv[3],process.argv[4]);
    process.stdout.write('Installed '+out.files.length+' verified offline sound clips\n');}
  catch(error){process.stderr.write('Audio profile rejected: '+error.message+'\n');process.exitCode=1;}
}
module.exports=install;
