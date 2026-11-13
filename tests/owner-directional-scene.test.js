'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const validate=require('../framework/asset-manifest');
const createScene=require('../framework/scene');
const createEngine=require('../framework/runtime');
const project=require('../fixtures/engine-project');
const makeWorld=require('../enginehost/party-world-host');
const worldProject=require('../fixtures/party-world-project');
const script=path.join(__dirname,'../scripts/build_owner_art_profile.py');
function sandbox(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bf-directions-'));
  const pack=path.join(root,'runtime-pack');fs.mkdirSync(pack);
  const source_entries=[],assets={};
  const dims={floor:[32,32],wall:[32,32],idle:[96,128],
    walk:[160,128],marker:[32,64],unused:[48,80]};
  for(const [key,size] of Object.entries(dims)){
    const id='asset_'+key;
    assets[id]={type:'image',path:'library/'+id+'.png',
      width:size[0],height:size[1],pixelArt:true,preload:false};
    source_entries.push({source_archive:'owned.zip',nested_zip:'sprites.zip',
      original_path:key+'.png',runtime_id:id});
  }
  fs.writeFileSync(path.join(pack,'asset-manifest.json'),JSON.stringify({version:1,assets}));
  fs.writeFileSync(path.join(root,'source-inventory.json'),JSON.stringify({source_entries}));
  const ref=(key,x=0,y=0,w,h)=>({
    source_archive:'owned.zip',nested_zip:'sprites.zip',
    original_path:key+'.png',...(w?{x,y,w,h}:{})});
  const directions={};
  for(const [direction,row] of Object.entries({down:0,left:3,right:2,up:1}))
    directions[direction]={idle:ref('idle',0,row*32,32,32),
      walk:[0,1,2,3].map(col=>ref('walk',col*32,row*32,32,32))};
  const roles={version:1,tileSize:32,
    tiles:{floor:ref('floor'),wall:ref('wall')},
    sprites:{player:{ticksPerFrame:3,directions},
      eventMarker:{ticksPerFrame:1,frames:[ref('marker')]}},
    eventSprites:{supply:'eventMarker'}};
  const roleFile=path.join(root,'roles.json');
  return {root,roles,
    run:()=>{
      fs.writeFileSync(roleFile,JSON.stringify(roles));
      return cp.spawnSync('python3',[script,root,roleFile],{encoding:'utf8'});
    },
    clean:()=>fs.rmSync(root,{recursive:true,force:true})
  };
}
function player(packet){return packet.commands.find(c=>c.actor==='player');}
test('real source-sheet role compiler binds distinct idle/walk atlases in authored cardinal order',()=>{
  const t=sandbox();
  try{
    const p=t.run();assert.equal(p.status,0,p.stderr);
    const profile=JSON.parse(fs.readFileSync(path.join(t.root,'art-profile.json'),'utf8'));
    validate(profile.manifest);
    assert.equal(Object.keys(profile.manifest.assets).length,6);
    assert.equal(profile.manifest.assets.asset_unused.preload,false);
    assert.deepEqual(profile.requiredImages,['asset_floor','asset_idle','asset_marker','asset_walk','asset_wall']);
    assert.equal(profile.theme.sprites.player.directions.left.idle.y,96);
    const engine=createEngine(project),state=engine.fresh('Animation contract',87);
    const original=engine.serialize(state),view=engine.view(state);
    const composer=createScene(project,profile.theme);
    const show=(tick,dir,moving)=>player(composer.compose(view,{
      width:224,height:160,tick,playerDirection:dir,playerMoving:moving}));
    assert.equal(show(0,'down',false).imageId,'asset_idle');
    assert.equal(show(0,'up',false).source.y,32);
    assert.equal(show(0,'right',false).source.y,64);
    assert.deepEqual(show(0,'left',false).source,{x:0,y:96,w:32,h:32});
    assert.equal(show(0,'left',true).imageId,'asset_walk');
    assert.deepEqual(show(3,'left',true).source,{x:32,y:96,w:32,h:32});
    assert.deepEqual(show(9,'up',true).source,{x:96,y:32,w:32,h:32});
    assert.equal(show(12,'up',true).source.x,0);
    assert.equal(engine.serialize(state),original,'visual frames never write simulation data');
  }finally{t.clean();}
});
test('directional import rejects missing directions and crops that include labels/out-of-bounds',()=>{
  for(const mutate of [
    r=>delete r.sprites.player.directions.left,
    r=>r.sprites.player.directions.right.walk[0].x=160,
    r=>r.sprites.player.directions.up.walk=[],
    r=>r.sprites.player.directions.down.idle.original_path='missing.png'
  ]){
    const t=sandbox();
    try{mutate(t.roles);const result=t.run();assert.notEqual(result.status,0);
      assert.equal(fs.existsSync(path.join(t.root,'art-profile.json')),false);
    }finally{t.clean();}
  }
});
test('directional theme fails closed rather than showing wrong-facing or missing art',()=>{
  const t=sandbox();
  try{
    assert.equal(t.run().status,0);
    const profile=JSON.parse(fs.readFileSync(path.join(t.root,'art-profile.json'),'utf8'));
    const make=()=>createScene(project,profile.theme);
    assert.doesNotThrow(make);
    delete profile.theme.sprites.player.directions.up;
    assert.throws(make,/Four directional poses/);
    profile.theme.sprites.player.directions.up=
      JSON.parse(JSON.stringify(profile.theme.sprites.player.directions.down));
    profile.theme.sprites.player.directions.left.walk[1].x=200;
    assert.throws(make,/outside atlas/);
  }finally{t.clean();}
});
test('world facing is presentation-only across moves and process restarts',()=>{
  const data=Object.create(null);
  const storage={read:k=>data[k]||null,write:(k,v)=>{data[k]=v;return true;}};
  let world=makeWorld(storage,JSON.parse(JSON.stringify(worldProject)));
  assert.equal(world.facing(),'down');
  assert.equal(world.navigate('invalid').ok,false);
  assert.equal(world.facing(),'down');
  assert.equal(world.navigate('right').ok,true);
  assert.equal(world.facing(),'right');
  const view=world.view();
  world=makeWorld(storage,JSON.parse(JSON.stringify(worldProject)));
  assert.deepEqual(world.view(),view,'durable world state fully survives recreation');
  assert.equal(world.facing(),'down','ephemeral facing does not change save schema');
});
test('installed world forwards actual direction and motion flags to scene',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../enginehost/boot.js'),'utf8');
  assert.match(code,/playerDirection:partyWorld\.facing\(\)/);
  assert.match(code,/playerMoving:tick<playerWalkUntilTick/);
  assert.match(code,/pos\.x!==lastDrawnPlayer\.x/);
  assert.match(code,/current\.freePosition\|\|current/);
});
