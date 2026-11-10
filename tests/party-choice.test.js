const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const make=require('../enginehost/party-probe');
const store=()=>{const disk=Object.create(null);return {
 read:k=>Object.prototype.hasOwnProperty.call(disk,k)?disk[k]:null,
 write:(k,v)=>{disk[k]=v;return true;}};};
test('selected skill and target pass through canonical journal, not host-side combat logic',()=>{
 const p=make(store());assert.equal(p.begin().ok,true);
 assert.equal(p.snapshot().sequence,6);
 const original=p.battle();
 assert.equal(p.submit([{actor:'pilot',skill:'pulse',target:'missing'}]).ok,false);
 assert.equal(p.snapshot().sequence,6);
 const order=[{actor:'pilot',skill:'pulse',target:'crawler'}];
 assert.equal(p.submit(order).ok,true);
 const after=p.snapshot();
 assert.equal(after.sequence,7);assert.equal(after.savedRevision,7);
 assert.equal(after.playerMp,2);
 assert.ok(after.targetHp<original.foes[0].hp);
 assert.equal(original.party[0].mp,3,'view must be cloned');
});
test('DOM party selector has player skills, target restrictions and Android verification',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'../enginehost/party-ui.js'),'utf8');
 const boot=fs.readFileSync(path.join(__dirname,'../enginehost/boot.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../enginehost/index.html'),'utf8');
 const java=fs.readFileSync(path.join(__dirname,'../android/test/RouteRunner.java'),'utf8');
 const ci=fs.readFileSync(path.join(__dirname,'../.github/workflows/engine-ci.yml'),'utf8');
 assert.match(ui,/skillBook\[id\]/);
 assert.match(ui,/actor\.mp>=meta\.cost/);
 assert.match(ui,/chosen&&chosen\.kind==='heal'\?battle\.party/);
 assert.match(ui,/chosen&&chosen\.kind==='guard'\?\[actor\]:battle\.foes/);
 assert.match(ui,/probe\.submit\(orders\)/);
 assert.match(html,/id="party-controls"/);
 assert.match(html,/party-ui\.js/);
 assert.match(boot,/createBearframePartyCommandPanel/);
 assert.match(java,/checkUnifiedPartyChoice\(\)/);
 assert.match(java,/playerMp"\)!=2/);
 assert.match(ci,/stage unified-party-choice/);
});
