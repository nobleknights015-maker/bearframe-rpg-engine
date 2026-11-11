const test=require('node:test'),assert=require('node:assert/strict');
const create=require('../enginehost/input-host');
function mockBattle(){
 const doc={activeElement:null},sel=[],events=[];
 function control(kind,id,options){
   const c={id:id||'',tagName:kind,disabled:false,
     options:(options||[]).map(x=>({value:x})),selectedIndex:0,focused:0,clicked:0,
     hasAttribute:key=>key===(kind==='SELECT'?(id==='s'?'data-party-skill':'data-party-target'):''),
     getClientRects:()=>[{}],
     addEventListener(){},dispatchEvent:e=>{events.push(e.type);return true;},
     focus(){doc.activeElement=this;this.focused++;},
     click(){this.clicked++;},
     scrollIntoView(){}};
   Object.defineProperty(c,'value',{get(){return this.options[this.selectedIndex]?.value||'';}});
   return c;
 }
 const skill=control('SELECT','s',['strike','pulse','mend']);
 const target=control('SELECT','t',['crawler','guard']);
 const commit=control('BUTTON','party-commit',[]);
 sel.push(skill,target,commit);
 const battleRoot={querySelectorAll:()=>sel,querySelector:selector=>
   selector==='#party-commit'?commit:null};
 const world={ownerDocument:doc,querySelector:selector=>
   selector==='#party-world-battle'?battleRoot:selector==='#party-commit'?commit:null,
   querySelectorAll:()=>sel};
 const empty={ownerDocument:doc,querySelectorAll:()=>[],querySelector:()=>null,contains:()=>false};
 let tab='world',moves=0;
 const screens={current:()=>tab,select:id=>{tab=id;}};
 const adapter=create(screens,()=>({partyBattle:{},battle:null,prompt:null}),
   ()=>{moves++;return {ok:true};},{world,party:empty,save:empty});
 return {adapter,skill,target,commit,events,moves:()=>moves,doc};
}
test('controller battle navigation cycles ability but never autocommits a round',()=>{
 const h=mockBattle();
 assert.equal(h.adapter.handle({type:'confirm'}),true);
 assert.equal(h.skill.focused,1);
 assert.equal(h.commit.clicked,0);
 assert.equal(h.adapter.handle({type:'navigate',direction:'right'}),true);
 assert.equal(h.skill.value,'pulse');
 assert.deepEqual(h.events,['change']);
 assert.equal(h.moves(),0);
 assert.equal(h.adapter.handle({type:'navigate',direction:'down'}),true);
 assert.equal(h.target.focused,1);
 assert.equal(h.adapter.handle({type:'navigate',direction:'right'}),true);
 assert.equal(h.target.value,'guard');
 assert.equal(h.adapter.handle({type:'navigate',direction:'up'}),true);
 assert.equal(h.skill.focused,2);
 assert.equal(h.adapter.handle({type:'confirm'}),true);
 assert.equal(h.target.focused,2);
 assert.equal(h.adapter.handle({type:'confirm'}),true);
 assert.equal(h.commit.focused,1);
 assert.equal(h.commit.clicked,0);
 assert.equal(h.adapter.handle({type:'confirm'}),true);
 assert.equal(h.commit.clicked,1);
 assert.equal(h.moves(),0);
});
test('unsupported and invalid battle actions do not submit orders',()=>{
 const h=mockBattle();
 assert.equal(h.adapter.handle({type:'navigate',direction:'diagonal'}),false);
 assert.equal(h.adapter.handle({type:'confirm'}),true);
 assert.equal(h.adapter.handle({type:'navigate',direction:'left'}),true,
   'when first option cannot decrease, next action receives focus');
 assert.equal(h.commit.clicked,0);
 assert.equal(h.moves(),0);
});
test('Android original party choice and native v2 controller remain isolated',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const source=read('enginehost/input-host.js');
 assert.match(source,/if\(selected&&selected.id==='party-commit'\)/);
 assert.match(source,/select\.dispatchEvent\(new Event\('change'/);
 assert.match(source,/world\.partyBattle\?'#party-world-battle'/);
});
