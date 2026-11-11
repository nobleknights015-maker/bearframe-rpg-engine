const test=require('node:test');
const assert=require('node:assert/strict');
const factory=require('../framework/character-sprites');
const sceneFactory=require('../framework/scene');
const engineFactory=require('../framework/runtime');
const project=require('../fixtures/engine-project');
const clone=x=>JSON.parse(JSON.stringify(x));
const sheet={atlas:'characters',frameWidth:32,frameHeight:48,
 columns:3,rows:4,stepFrames:[0,1,2,1],stepDurationMs:150};
test('ported Engine v1 character sheet chooses facing and walking frames',()=>{
 const sprite=factory(sheet);
 assert.deepEqual(sprite.frameFor({direction:'down',moving:false}),
  {column:1,row:0,sx:32,sy:0,sw:32,sh:48});
 assert.deepEqual(sprite.frameFor({direction:'left',moving:true,elapsedMs:0}),
  {column:0,row:1,sx:0,sy:48,sw:32,sh:48});
 assert.deepEqual(sprite.frameFor({direction:'left',moving:true,elapsedMs:150}),
  {column:1,row:1,sx:32,sy:48,sw:32,sh:48});
 assert.deepEqual(sprite.frameFor({direction:6,moving:true,elapsedMs:300}),
  {column:2,row:2,sx:64,sy:96,sw:32,sh:48});
 assert.deepEqual(sprite.frameFor({direction:8,moving:false,pattern:0}),
  {column:0,row:3,sx:0,sy:144,sw:32,sh:48});
 assert.equal(sprite.frameFor({direction:'up',moving:true,elapsedMs:450}).sx,32);
 assert.deepEqual(sprite.frameFor({direction:'up',moving:true,elapsedMs:450}),
  sprite.frameFor({direction:'up',moving:true,elapsedMs:1050}),
  'walking frames repeat deterministically');
});
test('directional sheet dimensions, patterns and atlas bounds fail closed',()=>{
 assert.throws(()=>factory({...sheet,columns:0}),/Invalid directional/);
 assert.throws(()=>factory({...sheet,stepFrames:[0,4]}),/Invalid directional/);
 assert.throws(()=>factory({...sheet,frameHeight:-1}),/Invalid directional/);
 assert.throws(()=>factory({...sheet,atlas:''}),/atlas ID/);
 assert.throws(()=>factory(sheet).frameFor({pattern:1.5}),/pattern must be integer/);
});
test('scene composes directional NPC sprites using the existing camera and depth sort',()=>{
 const theme={tileSize:32,clearColor:'#101018',
   atlases:{terrain:{width:64,height:32},characters:{width:96,height:192}},
   tiles:{floor:{atlas:'terrain',x:0,y:0,w:32,h:32},
          wall:{atlas:'terrain',x:32,y:0,w:32,h:32}},
   sprites:{player:{sheet:clone(sheet)},scout:{sheet:clone(sheet)}}};
 const engine=engineFactory(project),s=engine.fresh('Visual',33),v=engine.view(s);
 const composer=sceneFactory(project,clone(theme));
 const initial=JSON.stringify(v);
 const a=composer.compose(v,{width:224,height:160,tick:6,playerDirection:'right',
   actors:[{id:'npc',sprite:'scout',x:2,y:2,direction:'left',moving:true}]});
 const p=a.commands.find(c=>c.actor==='player');
 const npc=a.commands.find(c=>c.actor==='npc');
 assert.ok(p&&npc);
 assert.deepEqual(p.source,{x:32,y:96,w:32,h:48});
 assert.deepEqual(npc.source,{x:64,y:48,w:32,h:48});
 assert.equal(npc.imageId,'characters');
 assert.deepEqual(npc.world,{x:2,y:2});
 assert.equal(JSON.stringify(v),initial,'appearance may not mutate save view');
 assert.deepEqual(composer.compose(v,{width:224,height:160,tick:6,playerDirection:'right',
   actors:[{id:'npc',sprite:'scout',x:2,y:2,direction:'left',moving:true}]}),a);
 theme.atlases.characters.height=96;
 assert.throws(()=>sceneFactory(project,theme),/Directional sheet outside atlas/);
});
test('existing flat-frame sprite projects remain valid, and port ships in Android/Rhino',()=>{
 const theme={tileSize:32,clearColor:'#101018',
  atlases:{terrain:{width:64,height:32},characters:{width:64,height:48}},
  tiles:{floor:{atlas:'terrain',x:0,y:0,w:32,h:32},
         wall:{atlas:'terrain',x:32,y:0,w:32,h:32}},
  sprites:{player:{ticksPerFrame:5,frames:[
    {atlas:'characters',x:0,y:0,w:32,h:48}]}}};
 const engine=engineFactory(project),scene=sceneFactory(project,theme);
 assert.equal(scene.compose(engine.view(engine.fresh('Legacy')),{
   width:224,height:160,tick:0}).commands.find(c=>c.actor==='player').source.x,0);
 const fs=require('node:fs'),path=require('node:path');
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const html=read('enginehost/index.html'),ci=read('.github/workflows/engine-ci.yml');
 assert.match(html,/character-sprites\.js/);
 assert.ok(html.indexOf('character-sprites.js')<html.indexOf('scene.js'),
   'portable sprite helper must load before scene composer');
 assert.match(ci,/framework\/character-sprites\.js/);
 const android=read('android/test/RouteRunner.java');
 assert.match(android,/createBearframeCharacterSpriteRenderer/);
 assert.match(android,/getJSONObject\("directional"\)/);
 assert.match(android,/walk\.getInt\("column"\)!=2/);
 assert.match(read('android/build.sh'),/framework\/\*\.js/);
});
