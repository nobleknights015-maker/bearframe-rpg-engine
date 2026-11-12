'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const validate=require('../framework/asset-manifest'),composer=require('../framework/scene');
const engine=require('../framework/runtime'),project=require('../fixtures/engine-project');
const script=path.join(__dirname,'../scripts/build_owner_art_profile.py');
function temp(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bf-profile-'));
 const pack=path.join(root,'runtime-pack');fs.mkdirSync(pack);
 const assets={},source_entries=[];
 for(const [key,size] of Object.entries({floor:[32,32],wall:[32,32],player:[32,64],marker:[32,48],unused:[64,64]})){
  const id='asset_'+key;
  assets[id]={type:'image',path:'library/'+id+'.png',width:size[0],height:size[1],pixelArt:true,preload:false};
  source_entries.push({source_archive:'original.zip',nested_zip:'nested.zip',original_path:key+'.png',runtime_id:id});
 }
 fs.writeFileSync(path.join(pack,'asset-manifest.json'),JSON.stringify({version:1,assets}));
 fs.writeFileSync(path.join(root,'source-inventory.json'),JSON.stringify({source_entries}));
 const ref=key=>({source_archive:'original.zip',nested_zip:'nested.zip',original_path:key+'.png'});
 const roles={version:1,tileSize:32,tiles:{floor:ref('floor'),wall:ref('wall')},
  sprites:{player:{ticksPerFrame:3,frames:[ref('player')]},eventMarker:{ticksPerFrame:1,frames:[ref('marker')]}},
  eventSprites:{supply:'eventMarker'}};
 const roleFile=path.join(root,'roles.json');
 return {root,pack,roles,save:()=>fs.writeFileSync(roleFile,JSON.stringify(roles)),
  run:()=>cp.spawnSync('python3',[script,root,roleFile],{encoding:'utf8'}),
  clean:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('full owner library stays lazy while actual native tile and tall actors reach the scene renderer',()=>{
 const t=temp();
 try{
  t.save();const process=t.run();assert.equal(process.status,0,process.stderr);
  const profile=JSON.parse(fs.readFileSync(path.join(t.root,'art-profile.json'),'utf8'));
  validate(profile.manifest);
  assert.equal(Object.keys(profile.manifest.assets).length,5);
  assert.equal(profile.manifest.assets.asset_unused.preload,false);
  assert.equal(profile.manifest.assets.asset_unused.path,'enginehost/packs/active/library/asset_unused.png');
  assert.deepEqual(profile.requiredImages,['asset_floor','asset_marker','asset_player','asset_wall']);
  assert.deepEqual(profile.theme.tiles.floor,{atlas:'asset_floor',x:0,y:0,w:32,h:32});
  assert.equal(profile.theme.sprites.player.frames[0].h,64);
  const g=engine(project),state=g.fresh('Artist test',7);
  const packet=composer(project,profile.theme).compose(g.view(state),{width:128,height:128,tick:0});
  assert.ok(packet.commands.some(c=>c.imageId==='asset_floor'));
  assert.ok(packet.commands.some(c=>c.imageId==='asset_player'));
  assert.equal(packet.commands.filter(c=>c.type==='sprite').every(c=>profile.requiredImages.includes(c.imageId)),true);
  assert.notEqual(t.run().status,0,'existing profile must never be overwritten');
 }finally{t.clean();}
});
test('bad source name, false 32px tile and cropped frames are refused without emitting profile',()=>{
 for(const corrupt of [
  x=>{x.tiles.wall.original_path='missing.png';},
  x=>{x.tiles.wall.original_path='marker.png';},
  x=>{x.sprites.player.frames[0].x=20;x.sprites.player.frames[0].w=32;},
  x=>{x.tiles.floor.nested_zip='wrong.zip';}
 ]){
  const t=temp();try{
   corrupt(t.roles);t.save();assert.notEqual(t.run().status,0);
   assert.equal(fs.existsSync(path.join(t.root,'art-profile.json')),false);
  }finally{t.clean();}
 }
});
