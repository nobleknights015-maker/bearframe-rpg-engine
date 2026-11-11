const test=require('node:test'),assert=require('node:assert/strict');
const make=require('../enginehost/input-host');
function harness(){
 const panels=Object.fromEntries(['world','party','save'].map(k=>[k,{
  ownerDocument:null,nodes:{},querySelector(selector){return this.nodes[selector]||null;},
  querySelectorAll(){return Object.values(this.nodes);},
  contains(el){return Object.values(this.nodes).includes(el);}
 }]));
 const doc={activeElement:null};
 Object.values(panels).forEach(p=>p.ownerDocument=doc);
 function button(panel,selector,disabled){
  const p=panels[panel];
  const item={disabled:!!disabled,clicked:0,focused:0,
   getClientRects:()=>[{}],click(){this.clicked++;},
   focus(){this.focused++;doc.activeElement=this;},
   scrollIntoView(){}};
  item.hasAttribute=key=>selector.includes(key);
  p.nodes[selector]=item;
  return item;
 }
 let tab='world',state={prompt:null,partyBattle:null,battle:null},moves=0;
 const screens={current:()=>tab,select:k=>(tab=k)};
 const input=make(screens,()=>state,dir=>{moves++;return {ok:true,dir};},panels);
 return {input,panels,button,view:s=>state=s,get state(){return state;},
  screen:()=>tab,moves:()=>moves,doc};
}
test('controller map navigation calls the same durable world action only in explore mode',()=>{
 const h=harness();
 assert.equal(h.input.handle({type:'navigate',direction:'right'}),true);
 assert.equal(h.moves(),1);
 assert.equal(h.input.handle({type:'navigate',direction:'diagonal'}),false);
 assert.equal(h.moves(),1);
 const e=h.button('world','[data-event-choice]');
 h.view({prompt:{event:'supply'}});
 assert.equal(h.input.handle({type:'navigate',direction:'down'}),true);
 assert.equal(h.moves(),1);
 assert.equal(e.focused,1);
 assert.equal(h.input.handle({type:'confirm'}),true);
 assert.equal(e.clicked,1);
});
test('controller tabs and save verification are presentation-only',()=>{
 const h=harness(),verify=h.button('save','#party-world-verify');
 assert.equal(h.input.handle({type:'menu'}),true);
 assert.equal(h.screen(),'party');
 assert.equal(h.input.handle({type:'next-tab'}),true);
 assert.equal(h.screen(),'save');
 assert.equal(h.input.handle({type:'confirm'}),true);
 assert.equal(verify.clicked,1);
 assert.equal(h.moves(),0);
 assert.equal(h.input.handle({type:'cancel'}),true);
 assert.equal(h.screen(),'world');
 assert.equal(h.input.handle({type:'pause'}),true);
 assert.equal(h.screen(),'save');
 assert.equal(h.input.handle({type:'map'}),true);
 assert.equal(h.screen(),'world');
});
test('party confirm selects then activates a visible enabled equipment action',()=>{
 const h=harness(),equip=h.button('party','[data-inventory-equip]');
 h.input.handle({type:'menu'});
 assert.equal(h.input.handle({type:'confirm'}),true);
 assert.equal(equip.clicked,0);
 assert.equal(equip.focused,1);
 assert.equal(h.input.handle({type:'confirm'}),true);
 assert.equal(equip.clicked,1);
 equip.disabled=true;
 assert.equal(h.input.handle({type:'confirm'}),false);
});
test('unknown semantic input cannot mutate gameplay and native host wires bridge',()=>{
 const h=harness();
 assert.equal(h.input.handle(null),false);
 assert.equal(h.input.handle({type:'invalid'}),false);
 assert.equal(h.moves(),0);
 const fs=require('node:fs'),path=require('node:path');
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 assert.match(read('enginehost/index.html'),/input-host\.js/);
 assert.match(read('enginehost/boot.js'),/createBearframeWorldInput\(/);
 assert.match(read('enginehost/boot.js'),/input:function\(action\)/);
});
