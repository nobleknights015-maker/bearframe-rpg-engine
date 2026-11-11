const test=require('node:test'),assert=require('node:assert/strict');
const makePanel=require('../enginehost/runtime-panels');
const makeEngine=require('../framework/runtime');
const party=require('../fixtures/party-world-project');
const v1=require('../fixtures/engine-project');
const clone=v=>JSON.parse(JSON.stringify(v));
function dom(){
 const doc={};
 class Node{
  constructor(tag){this.tag=tag;this.ownerDocument=doc;this.children=[];this.value='';
   this._text='';this.attributes={};this.disabled=false;}
  appendChild(v){this.children.push(v);return v;}
  get firstChild(){return this.children.length?this.children[0]:null;}
  removeChild(v){this.children.splice(this.children.indexOf(v),1);}
  setAttribute(k,v){this.attributes[k]=String(v);}
  addEventListener(){}
  set textContent(v){this._text=String(v);this.children.length=0;}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
 }
 doc.createElement=tag=>new Node(tag);
 function find(root,attribute,value){
  if(root.attributes[attribute]===value)return root;
  for(const child of root.children){const found=find(child,attribute,value);if(found)return found;}
  return null;
 }
 return {create:tag=>doc.createElement(tag),find};
}
test('roster UI shows persisted HP, MP, stats and progression without mutating state',()=>{
 const e=makeEngine(clone(party));let state=e.fresh('Viewer',44);
 state.allies.push('scout');
 state.allyStats.scout={hp:19,mp:1,xp:0};
 const view=e.view(state),before=e.serialize(state);
 const d=dom(),events=d.create('div'),gear=d.create('div'),status=d.create('p');
 const panel=makePanel(events,gear,status,party,()=>view,()=>{throw Error('unexpected dispatch');});
 panel.render();
 const lead=d.find(gear,'data-party-actor','pilot');
 const scout=d.find(gear,'data-party-actor','scout');
 assert.ok(lead&&scout);
 assert.match(lead.textContent,/Viewer · HP 30\/30 · MP 3\/3/);
 assert.match(scout.textContent,/Test scout · HP 19\/24 · MP 1\/2/);
 assert.match(gear.textContent,/Level 1/);
 assert.equal(e.serialize(state),before);
});
test('roster UI reads live battle resources, and v1 remains free of party HUD',()=>{
 const e=makeEngine(clone(party));let state=e.fresh('Battle',23);
 state=e.step(state,{type:'move',dir:'down'});
 state=e.step(state,{type:'move',dir:'down'});
 state=e.step(state,{type:'move',dir:'right'});
 state=e.step(state,{type:'move',dir:'right'});
 state=e.step(state,{type:'move',dir:'up'});
 state=e.step(state,{type:'move',dir:'up'});
 assert.ok(state.partyBattle);
 state=e.step(state,{type:'party-round',orders:[{actor:'pilot',skill:'pulse',target:'crawler'}]});
 const v=e.view(state),d=dom(),events=d.create('div'),gear=d.create('div'),status=d.create('p');
 makePanel(events,gear,status,party,()=>v,()=>{throw Error('unexpected');}).render();
 const lead=d.find(gear,'data-party-actor','pilot');
 assert.ok(lead);
 assert.match(lead.textContent,new RegExp('MP '+v.charge+'/'+v.maxCharge));
 const old=makeEngine(clone(v1)),vOld=old.view(old.fresh('Original',34));
 const d2=dom(),eg=d2.create('div'),gr=d2.create('div'),st=d2.create('p');
 makePanel(eg,gr,st,v1,()=>vOld,()=>{throw Error('unexpected');}).render();
 assert.equal(d2.find(gr,'data-party-actor','pilot'),null);
});
