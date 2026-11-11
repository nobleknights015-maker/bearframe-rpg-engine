const test=require('node:test'),assert=require('node:assert/strict');
const make=require('../enginehost/party-ui');

function dom(){
 const doc={createElement(tag){return node(tag);}};
 function node(tag){
  const el={tagName:tag.toUpperCase(),ownerDocument:doc,children:[],
   handlers:{},disabled:false,textContent:'',id:'',
   appendChild(child){this.children.push(child);return child;},
   removeChild(child){this.children.splice(this.children.indexOf(child),1);return child;},
   setAttribute(){},addEventListener(name,fn){this.handlers[name]=fn;},
   click(){if(this.handlers.click)this.handlers.click();}};
  Object.defineProperty(el,'firstChild',{get(){return this.children[0]||null;}});
  if(tag==='select')
   Object.defineProperty(el,'value',{get(){return this.children[0]?.value||'';}});
  return el;
 }
 return doc.createElement('div');
}
function battle(){
 return {phase:'active',party:[{id:'pilot',name:'Pilot',hp:18,maxHp:20,
    mp:4,maxMp:5,skills:['strike']}],
  foes:[{id:'crawler',name:'Crawler',hp:9,maxHp:10}]};
}
function setup(notify){
 const root=dom();let reads=0,submits=0;
 const probe={battle(){reads++;return battle();},
  submit(orders){submits++;assert.deepEqual(orders,[{
    actor:'pilot',skill:'strike',target:'crawler'}]);
    return {ok:true};}};
 let panel;
 panel=make(root,probe,{strike:{cost:0,kind:'damage'}},
   outcome=>notify(outcome,()=>panel.render()));
 panel.render();
 function commit(){
  const button=root.children.find(n=>n.id==='party-commit');
  assert.ok(button,'battle confirm is present');
  assert.equal(button.disabled,false);
  button.click();
 }
 return {root,commit,reads:()=>reads,submits:()=>submits};
}
test('integrated battle host renders only once and retains its installed page controls',()=>{
 let retained;
 const h=setup((outcome,render)=>{
  assert.equal(outcome.ok,true);
  render();
  retained=h.root.children.slice();
  return true;
 });
 assert.equal(h.reads(),1);
 h.commit();
 assert.equal(h.submits(),1);
 assert.equal(h.reads(),2,'no second re-render may destroy the new pager');
 assert.deepEqual(h.root.children,retained,
  'controls installed by host notification must survive commit callback');
});
test('standalone party panel preserves its own fallback rendering contract',()=>{
 const h=setup(()=>false);
 h.commit();
 assert.equal(h.submits(),1);
 assert.equal(h.reads(),2,'unhandled notification still redraws the panel');
});
test('host-handled rejected battle action can preserve the current UI',()=>{
 const root=dom();let reads=0,handled=0;
 const probe={battle(){reads++;return battle();},
  submit(){return {ok:false,reason:'bad-orders'};}};
 const panel=make(root,probe,{strike:{cost:0,kind:'damage'}},()=>{
  handled++;return true;
 });
 panel.render();
 const before=root.children.slice();
 root.children.find(n=>n.id==='party-commit').click();
 assert.equal(handled,1);
 assert.equal(reads,1);
 assert.deepEqual(root.children,before,
  'a rejected turn must not discard the active landscape pager');
});
