#!/usr/bin/env node
'use strict';
/* Validate an external engine content project and emit data ONLY.
 * The WebView never evaluates source supplied by a content pack.
 * Legacy project fixtures and all existing save namespaces remain untouched.
 */
const fs=require('node:fs'),path=require('node:path');
const validateProject=require('../framework/schema');
const createEngine=require('../framework/runtime');
function build(input,output){
  if(typeof input!=='string'||typeof output!=='string'||!input||!output)
    throw new TypeError('Input and output paths required');
  const source=path.resolve(input),dest=path.resolve(output);
  if(source===dest)throw new Error('Cannot overwrite content project input');
  const stat=fs.lstatSync(source);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<2||stat.size>4*1024*1024)
    throw new Error('Invalid content profile source file');
  const parsed=JSON.parse(fs.readFileSync(source,'utf8'));
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||
     Object.keys(parsed).sort().join(',')!=='project,version'||parsed.version!==1)
    throw new TypeError('Expected versioned content profile with project record');
  const project=parsed.project;
  validateProject(project);
  if(!project.partyCombat||!project.partyCombat.progression||
     !project.contentRevision)
    throw new TypeError('Reusable world requires v2 party progression and contentRevision');
  // A complete, playable initial state must pass the same core validators as
  // a real Android boot. This never writes a save.
  const engine=createEngine(project);
  const first=engine.fresh('Content package verification',17);
  const body=engine.serialize(first);
  if(!engine.restore(body))
    throw new Error('Content project failed state serialization roundtrip');
  const literal=JSON.stringify({version:1,project:project}).replace(/[\u2028\u2029]/g,
    c=>c==='\u2028'?'\\u2028':'\\u2029');
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,
    '/* Validated authored content, not executable project JavaScript. */\n'+
    'var BEARFRAME_CONTENT_PROFILE = '+literal+';\n','utf8');
  return {id:project.id,revision:project.contentRevision,bytes:body.length};
}
module.exports=build;
if(require.main===module){
  if(process.argv.length!==4){
    console.error('Usage: node scripts/build_content_profile.js OWNER_PROJECT.json OUTPUT.js');
    process.exitCode=2;
  }else try{
    const info=build(process.argv[2],process.argv[3]);
    console.log('Validated engine content '+info.id+' revision '+info.revision);
  }catch(error){
    console.error('Content profile build refused: '+error.message);
    process.exitCode=1;
  }
}
