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
  item.getAttribute=key=>key==='data-engine-page'?
    (selector.match(/data-engine-page="([^"]+)"/)||[])[1]||null:null;
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
 const diagnostics=h.button('save','#landscape-open-diagnostics');
 diagnostics.focus();
 assert.equal(h.input.handle({type:'confirm'}),true);
 assert.equal(diagnostics.clicked,1,'highlighted save-screen action should activate');
 assert.equal(verify.clicked,1,'save verification must not fire for another action');
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

test('controller Confirm opens visible event pages and closes events without choosing a response',()=>{
 const h=harness();
 const answer=h.button('world','[data-event-choice]');
 const next=h.button('world','[data-engine-page="events:1"]');
 const previous=h.button('world','[data-engine-page="events:-1"]',true);
 const foreign=h.button('world','[data-engine-page="battle:1"]');
 const close=h.button('world','[data-event-close]');
 h.view({prompt:{event:'example'},partyBattle:null,battle:null});
 next.focus();
 assert.equal(h.input.handle({type:'confirm'}),true);
 assert.equal(next.clicked,1);
 assert.equal(answer.clicked,0);
 previous.focus();
 assert.equal(h.input.handle({type:'confirm'}),false,'disabled page button is inert');
 assert.equal(answer.clicked,0);
 foreign.focus();
 assert.equal(h.input.handle({type:'confirm'}),false,'wrong menu pager is inert');
 assert.equal(answer.clicked,0);
 close.focus();
 assert.equal(h.input.handle({type:'confirm'}),true);
 assert.equal(close.clicked,1);
 assert.equal(answer.clicked,0,'Close cannot choose the first dialogue answer');
 assert.equal(h.moves(),0);
});

test('production JRPG shoulders open command UI instead of invisible developer tabs',()=>{
 const base=harness(),calls=[];let open=false,moves=0;
 const menu={isOpen:()=>open,handle:function(action){
   calls.push(action.type);
   if(action.type==='menu')open=true;
   if(action.type==='cancel')open=false;
   return true;
 }};
 const input=make({current:()=>base.screen(),select:()=>{}},
   ()=>base.state,()=>{moves++;return {ok:true};},base.panels,menu);
 assert.equal(input.handle({type:'previous-tab'}),true);
 assert.deepEqual(calls,['menu','previous-tab']);
 assert.equal(open,true);
 assert.equal(input.handle({type:'navigate',direction:'right'}),true);
 assert.equal(moves,0,'menu directional input never moves the world');
 assert.equal(input.handle({type:'cancel'}),true);
 assert.equal(open,false);
 assert.equal(input.handle({type:'next-tab'}),true);
 assert.deepEqual(calls.slice(-2),['menu','next-tab']);
});

test('four-way live controller routes diagonal stick signals to one cardinal action',()=>{
 const base=harness(),calls=[];
 let v={prompt:null,partyBattle:null,battle:null,movementMode:'free',
        movementDirections:4};
 const input=make({current:()=>base.screen(),select:()=>{}},()=>v,
   dir=>{calls.push(dir);return {ok:true};},base.panels);
 for(const [source,expected] of [
   ['up-right','up'],['down-left','down'],
   ['left','left'],['right','right']
 ]){
   assert.equal(input.handle({type:'navigate',direction:source}),true);
   assert.equal(calls.at(-1),expected);
 }
 assert.deepEqual(calls,['up','down','left','right']);
 v={...v,movementMode:'tile',movementDirections:4};
 assert.equal(input.handle({type:'navigate',direction:'down-right'}),true);
 assert.equal(calls.at(-1),'down');
 v={...v,movementMode:'free',movementDirections:8};
 assert.equal(input.handle({type:'navigate',direction:'up-right'}),true);
 assert.equal(calls.at(-1),'up-right','eight-way code only for explicit eight-way profile');
 assert.equal(input.handle({type:'navigate',direction:'bad'}),false);
 assert.equal(calls.length,6);
});

test('event confirm ignores detached, hidden and disabled stale answers',()=>{
 const h=harness();
 const stale=h.button('world','[data-event-choice="stale"]');
 const live=h.button('world','[data-event-choice="live"]');
 h.view({prompt:{event:'current'},partyBattle:null,battle:null});
 stale.focus();
 stale.getClientRects=()=>[];
 assert.equal(h.input.handle({type:'confirm'}),true);
 assert.equal(stale.clicked,0);
 assert.equal(live.clicked,1);
 live.disabled=true;
 assert.equal(h.input.handle({type:'confirm'}),false);
 assert.equal(live.clicked,1);
 const replacement=h.button('world','[data-event-choice="replacement"]');
 delete h.panels.world.nodes['[data-event-choice="stale"]'];
 live.disabled=false;
 stale.focus();
 assert.equal(h.input.handle({type:'confirm'}),true);
 assert.equal(stale.clicked,0,'detached choice cannot be submitted');
 assert.equal(live.clicked,2,'current visible choice is used instead');
 assert.equal(replacement.clicked,0);
 assert.equal(h.moves(),0,'no world movement during event selection');
});
