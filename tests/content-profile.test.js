'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const build=require('../scripts/build_content_profile');
const makeWorld=require('../enginehost/party-world-host');
const fixture=require('../fixtures/party-world-project');
const clone=x=>JSON.parse(JSON.stringify(x));
function sandbox(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bf-content-profile-'));
  const input=path.join(dir,'project.json'),output=path.join(dir,'generated.js');
  const project=clone(fixture);
  project.id='ci-content-source';
  project.contentRevision='content_source_1';
  return {dir,input,output,project,
    write(){fs.writeFileSync(input,JSON.stringify({version:1,project}));},
    clean(){fs.rmSync(dir,{recursive:true,force:true});}};
}
test('validates a complete author-owned project without executing source code',()=>{
  const x=sandbox();
  try{
    x.write();const info=build(x.input,x.output);
    assert.deepEqual({id:info.id,revision:info.revision},
      {id:'ci-content-source',revision:'content_source_1'});
    const text=fs.readFileSync(x.output,'utf8');
    assert.match(text,/var BEARFRAME_CONTENT_PROFILE = /);
    const sandbox={};vm.runInNewContext(text,sandbox,{timeout:1000});
    assert.equal(sandbox.BEARFRAME_CONTENT_PROFILE.version,1);
    assert.equal(sandbox.BEARFRAME_CONTENT_PROFILE.project.id,'ci-content-source');
    assert.deepEqual(sandbox.BEARFRAME_CONTENT_PROFILE.project.maps.hub.rows,
      fixture.maps.hub.rows);
    assert.ok(!text.includes('require('));
  }finally{x.clean();}
});
test('compilation refuses invalid content, malformed profile and unplayable start state',()=>{
  const failures=[
    p=>delete p.partyCombat.progression,
    p=>delete p.contentRevision,
    p=>p.maps.hub.rows[0]='invalid',
    p=>p.start={map:'hub',x:0,y:0},
    p=>p.partyCombat.enemies={},
    p=>p.contentRevision='invalid revision'
  ];
  for(const mutate of failures){
    const x=sandbox();
    try{mutate(x.project);x.write();
      assert.throws(()=>build(x.input,x.output));
      assert.equal(fs.existsSync(x.output),false);
    }finally{x.clean();}
  }
  const x=sandbox();
  try{
    fs.writeFileSync(x.input,'{"version":1,"project":null}');
    assert.throws(()=>build(x.input,x.output));
    assert.equal(fs.existsSync(x.output),false);
    fs.writeFileSync(x.input,'{"version":2,"project":{}}');
    assert.throws(()=>build(x.input,x.output));
  }finally{x.clean();}
});
test('external runtime content has isolated durable journal while diagnostic save survives',()=>{
  const data=Object.create(null);
  const storage={read:k=>Object.prototype.hasOwnProperty.call(data,k)?data[k]:null,
    write:(k,v)=>{data[k]=v;return true;}};
  const authored=clone(fixture);authored.id='ci-content-source';
  authored.contentRevision='content_source_1';
  const isolated='bf:'+authored.id+':v2:runtime';
  let original=makeWorld(storage,clone(fixture));
  assert.equal(original.navigate('down').ok,true);
  const prior=original.view();
  const owner=makeWorld(storage,authored,null,{slotPrefix:isolated});
  assert.equal(owner.view().sequence,0);
  assert.equal(owner.navigate('right').ok,true); // supply event, not movement
  assert.equal(owner.view().sequence,1);
  assert.equal(owner.verifySave().ok,true);
  assert.deepEqual(makeWorld(storage,clone(fixture)).view(),prior);
  const recovered=makeWorld(storage,clone(authored),null,{slotPrefix:isolated});
  assert.deepEqual(recovered.view(),owner.view());
  assert.equal(recovered.verifySave().ok,true);
  authored.contentRevision='content_source_2';
  const incompatible=makeWorld(storage,authored,null,{slotPrefix:isolated});
  assert.equal(incompatible.snapshot().error,'incompatible-content');
  assert.equal(incompatible.navigate('down').ok,false);
  assert.deepEqual(makeWorld(storage,clone(fixture)).view(),prior);
});
test('Android WebView loads authored content before boot and all v2 UI panels share it',()=>{
  const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
  const html=read('enginehost/index.html');
  assert.ok(html.indexOf('src="content-profile.js"')>
    html.indexOf('src="../fixtures/party-world-project.js"'));
  assert.ok(html.indexOf('src="content-profile.js"')<
    html.indexOf('src="boot.js"'));
  const boot=read('enginehost/boot.js');
  assert.match(boot,/var authoredContent=BEARFRAME_CONTENT_PROFILE;/);
  assert.match(boot,/var partyWorldProject=authoredContent\?/);
  assert.match(boot,/createBearframePartyWorldHost\(storage,partyWorldProject,theme,/);
  assert.match(boot,/partyWorldStatus,partyWorldProject,/);
  assert.match(boot,/partyWorldProject\.partyCombat\.skills,function/);
  assert.match(boot,/bf:'\+partyWorldProject\.id\+':v2:runtime'/);
  const build=read('android/build.sh');
  assert.match(build,/BF_CONTENT_PROFILE_JSON/);
  assert.match(build,/scripts\/build_content_profile\.js/);
  const workflow=read('.github/workflows/engine-ci.yml');
  assert.match(workflow,/export BF_CONTENT_PROFILE_JSON=/);
  assert.match(workflow,/authored\\.id='ci-external-content'/);
  const android=read('android/test/RouteRunner.java');
  assert.match(android,/"ci-external-content"\\.equals\\(content\\.getString\\("id"\\)\\)/);
});
