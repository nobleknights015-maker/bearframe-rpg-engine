const test=require('node:test'),assert=require('node:assert/strict');
const session=require('../framework/session');
const actors=require('../framework/map-actors');
const project=require('../fixtures/party-world-project');
const clone=x=>JSON.parse(JSON.stringify(x));
const art={
 tileSize:32,clearColor:'#101018',
 atlases:{terrain:{width:64,height:32},characters:{width:64,height:48}},
 tiles:{floor:{atlas:'terrain',x:0,y:0,w:32,h:32},
   wall:{atlas:'terrain',x:32,y:0,w:32,h:32}},
 sprites:{
   player:{ticksPerFrame:5,frames:[{atlas:'characters',x:0,y:0,w:32,h:48}]},
   eventMarker:{ticksPerFrame:1,frames:[{atlas:'characters',x:32,y:0,w:32,h:48}]}
 },
 eventSprites:{supply:'eventMarker',mechanic:'eventMarker',scout:'eventMarker'}
};
function disk(){
 const files=Object.create(null);let writes=0;
 return {read:k=>Object.prototype.hasOwnProperty.call(files,k)?files[k]:null,
   write:(k,v)=>{files[k]=v;writes++;return true;},writes:()=>writes};
}
function start(storage){
 const s=session(clone(project),storage,clone(art),
   {slotPrefix:'bf:test:v1:map-actors'});
 const restored=s.resume();
 if(!restored.ok&&restored.reason==='no-save')
   assert.equal(s.start('Engine test',71).ok,true);
 else assert.equal(restored.ok,true);
 return s;
}
function ids(frame){
 return frame.commands.filter(c=>c.actor).map(c=>c.actor);
}
test('Engine v1 event actor bridge draws visible NPC/event tiles without changing saves',()=>{
 const store=disk(),s=start(store),before=store.writes();
 const packet=s.compose({width:224,height:160,tick:0});
 assert.ok(ids(packet).includes('player'));
 assert.ok(ids(packet).includes('event:supply:2,1'));
 assert.ok(ids(packet).includes('event:mechanic:2,2'));
 const mechanic=packet.commands.find(c=>c.actor==='event:mechanic:2,2');
 assert.equal(mechanic.imageId,'characters');
 assert.deepEqual(mechanic.world,{x:2,y:2});
 assert.deepEqual(mechanic.source,{x:32,y:0,w:32,h:48});
 assert.equal(store.writes(),before,'rendering must never touch durable storage');
 const again=s.compose({width:224,height:160,tick:0});
 assert.deepEqual(again,packet,'presentation must be deterministic');
});
test('once events disappear after durable resolution, recurring NPC stays visible',()=>{
 const store=disk(),s=start(store);
 assert.equal(s.dispatch({type:'move',dir:'right'}).ok,true);
 assert.equal(s.snapshot().view.prompt.event,'supply');
 assert.equal(s.dispatch({type:'choose',id:'collect'}).ok,true);
 const a=s.compose({width:224,height:160,tick:0});
 assert.equal(ids(a).includes('event:supply:2,1'),false);
 assert.equal(ids(a).includes('event:mechanic:2,2'),true);
 const reloaded=start(store);
 assert.equal(reloaded.verifySave().ok,true);
 assert.deepEqual(reloaded.compose({width:224,height:160,tick:0}),a);
});
test('explicit cutscene actors override engine event markers; missing art never fabricated',()=>{
 const store=disk(),s=start(store);
 const manual=s.compose({width:224,height:160,tick:0,actors:[]});
 assert.deepEqual(ids(manual),['player']);
 const hidden=actors(clone(project),{sprites:{player:art.sprites.player}});
 assert.deepEqual(hidden('hub',{}),[]);
 assert.throws(()=>hidden('missing',{}),/Unknown map/);
});
test('bundled Android WebView loads port before session and includes event marker binding',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 assert.match(read('enginehost/index.html'),/map-actors\.js"><\/script>[\s\S]*session\.js/);
 assert.match(read('enginehost/boot.js'),/eventSprites:\{supply:'eventMarker'/);
 assert.match(read('android/build.sh'),/framework\/\*\.js/);
 assert.match(read('.github/workflows/engine-ci.yml'),/framework\/map-actors\.js/);
});

test('an explicit NPC display binding cannot silently point at missing art',()=>{
 const source=clone(project),theme=clone(art);
 theme.eventSprites.mechanic='missing-atlas-sprite';
 assert.throws(()=>actors(source,theme),/Invalid NPC sprite binding mechanic/);
 theme.eventSprites.mechanic='eventMarker';
 theme.eventSprites.unknown='eventMarker';
 assert.throws(()=>actors(source,theme),/Invalid NPC sprite binding unknown/);
 delete theme.eventSprites.unknown;
 assert.ok(actors(source,theme)('hub',{}).some(x=>x.id==='event:mechanic:2,2'));
});

test('Android landscape acceptance measures actual NPC pixels rather than event text',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const host=read('enginehost/boot.js'),java=read('android/test/RouteRunner.java');
 const ci=read('.github/workflows/engine-ci.yml');
 assert.match(host,/sceneVisibilityAudit:function|sceneVisibilityAudit:sceneVisibilityAudit/);
 assert.match(host,/differentPixels\+\+/);
 assert.match(host,/actors\.length>0&&differentPixels>0/);
 assert.match(host,/actors:\[\]/);
 assert.match(java,/BearframeHost\.sceneVisibilityAudit\(\)/);
 assert.match(java,/getInt\("differentPixels"\)<20/);
 assert.match(java,/getInt\("revisionBefore"\)!=npcAudit\.getInt\("revisionAfter"\)/);
 assert.match(ci,/stage unified-landscape/);
});
