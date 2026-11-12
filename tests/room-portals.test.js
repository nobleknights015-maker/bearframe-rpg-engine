'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const make=require('../framework/scene'),engine=require('../framework/runtime');
const world=require('../fixtures/party-world-project');
const clone=x=>JSON.parse(JSON.stringify(x));
const mkframe=(atlas,w=32,h=32)=>({atlas,x:0,y:0,w,h});
const theme={tileSize:32,clearColor:'#101018',
  atlases:{floor:{width:32,height:32},wall:{width:32,height:32},
    grate:{width:32,height:32},rust:{width:32,height:32},
    shut:{width:32,height:64},open:{width:32,height:64},
    actor:{width:32,height:32}},
  tiles:{floor:mkframe('floor'),wall:mkframe('wall'),
    fieldFloor:mkframe('grate'),fieldWall:mkframe('rust')},
  mapTiles:{field:{floor:'fieldFloor',wall:'fieldWall'}},
  portals:{hub:mkframe('shut',32,64),field:mkframe('open',32,64)},
  sprites:{player:{ticksPerFrame:5,frames:[mkframe('actor')]}}};
function scene(view,art=theme){return make(world,art).compose(view,{width:224,height:160,tick:0,actors:[]});}
test('exit tiles paint authored door before actors, feet on actual transition tile',()=>{
  const e=engine(world),v=e.view(e.fresh('Room test',17));
  const a=scene(v),door=a.commands.find(c=>c.exit);
  assert.ok(door,'exit needs a visual');
  assert.equal(door.imageId,'shut');
  assert.deepEqual(door.exit,{map:'field',x:5,y:1});
  assert.equal(door.dest.x,(5*32-a.camera.x));
  assert.equal(door.dest.y,(2*32-64-a.camera.y));
  assert.ok(a.commands.indexOf(door)<a.commands.findIndex(c=>c.actor==='player'));
  assert.ok(a.commands.filter(c=>c.layer===0).every(c=>c.imageId==='floor'||c.imageId==='wall'));
});
test('destination room uses distinct floor and wall plus its own return door',()=>{
  const e=engine(world),s=e.fresh('Room test',17),v=e.view(s);
  const target={...v,map:'field',rows:world.maps.field.rows,x:1,y:1};
  const a=scene(target);
  assert.equal(a.commands.find(c=>c.layer===0&&c.world.x===2&&c.world.y===1).imageId,'grate');
  assert.equal(a.commands.find(c=>c.layer===0&&c.world.x===0&&c.world.y===0).imageId,'rust');
  const door=a.commands.find(c=>c.exit);
  assert.equal(door.imageId,'open');
  assert.deepEqual(door.exit,{map:'hub',x:1,y:2});
  assert.equal(door.dest.y,(3*32-64-a.camera.y));
});
test('invalid room visuals are rejected, old themes and canonical saves remain compatible',()=>{
  const e=engine(world),state=e.fresh('Untouched',17),saved=e.serialize(state);
  for(const mutate of [
    t=>{t.mapTiles.unknown={floor:'floor'};},
    t=>{t.mapTiles.field.floor='missing';},
    t=>{t.mapTiles.field.teleport='wall';},
    t=>{t.portals.hub.y=64;},
    t=>{t.portals.unknown=mkframe('shut',32,64);}
  ]){const bad=clone(theme);mutate(bad);assert.throws(()=>make(world,bad));}
  const legacy=clone(theme);delete legacy.portals;delete legacy.mapTiles;
  assert.equal(scene(e.view(state),legacy).commands.some(c=>c.exit),false);
  assert.equal(e.serialize(state),saved);
});
test('owner profile compiler includes native per-map terrain and portal source rectangles',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bf-portal-roles-'));
  try{
    const pack=path.join(root,'runtime-pack');fs.mkdirSync(pack);
    const assets={},source_entries=[];
    for(const [key,w,h] of [['floor',32,32],['wall',32,32],['field',32,32],
        ['door',32,64],['actor',32,32]]){
      assets['asset_'+key]={type:'image',path:'library/'+key+'.png',
        width:w,height:h,pixelArt:true,preload:false};
      source_entries.push({source_archive:'owner.zip',nested_zip:null,
        original_path:key+'.png',runtime_id:'asset_'+key});
    }
    fs.writeFileSync(path.join(pack,'asset-manifest.json'),JSON.stringify({version:1,assets}));
    fs.writeFileSync(path.join(root,'source-inventory.json'),JSON.stringify({source_entries}));
    const ref=key=>({source_archive:'owner.zip',original_path:key+'.png'});
    const roles={version:1,tileSize:32,tiles:{floor:ref('floor'),wall:ref('wall'),
      fieldFloor:ref('field')},sprites:{player:{ticksPerFrame:1,frames:[ref('actor')]}},
      mapTiles:{field:{floor:'fieldFloor'}},portals:{hub:ref('door'),field:ref('door')}};
    const file=path.join(root,'roles.json');fs.writeFileSync(file,JSON.stringify(roles));
    const script=path.join(__dirname,'../scripts/build_owner_art_profile.py');
    const run=cp.spawnSync('python3',[script,root,file],{encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    const profile=JSON.parse(fs.readFileSync(path.join(root,'art-profile.json'),'utf8'));
    assert.equal(profile.theme.portals.hub.h,64);
    assert.equal(profile.theme.mapTiles.field.floor,'fieldFloor');
    assert.ok(profile.requiredImages.includes('asset_door'));
    assert.equal(Object.keys(profile.manifest.assets).length,5);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('WebView announces actual room transitions over map, not in a separate developer tab',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 assert.match(read('enginehost/index.html'),/id="party-world-room-transition"/);
 assert.match(read('enginehost/boot.js'),/announceRoom\(v\)/);
 assert.match(read('enginehost/boot.js'),/lastRoom!==null/);
 assert.match(read('enginehost/host.css'),/@keyframes bearframe-room-reveal/);
 assert.match(read('enginehost/host.css'),/pointer-events:none/);
});
