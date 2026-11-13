'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const createMenu=require('../enginehost/jrpg-menu');
const createWorld=require('../enginehost/party-world-host');
const project=require('../fixtures/party-world-project');
function ui(){
  const nodes={};let doc;
  function element(tag){
    const listeners={},attrs={};
    const obj={tagName:tag.toUpperCase(),ownerDocument:doc||null,
      textContent:'',className:'',hidden:false,disabled:false,children:[],
      appendChild(n){this.children.push(n);n.parentNode=this;return n;},
      removeChild(n){this.children.splice(this.children.indexOf(n),1);n.parentNode=null;return n;},
      get firstChild(){return this.children[0]||null;},
      setAttribute(k,v){attrs[k]=String(v);},getAttribute(k){return attrs[k]||null;},
      addEventListener(k,fn){(listeners[k]||(listeners[k]=[])).push(fn);},
      click(){if(!this.disabled)(listeners.click||[]).forEach(fn=>fn({}));},
      focus(){doc.activeElement=this;},
      querySelector(selector){return nodes[selector]||null;}
    };
    return obj;
  }
  const toggled=new Set();
  doc={activeElement:null,body:{classList:{toggle(k,active){if(active)toggled.add(k);else toggled.delete(k);},contains:k=>toggled.has(k)}},createElement:tag=>element(tag)};
  const root=element('section'),open=element('button');
  root.ownerDocument=open.ownerDocument=doc;
  for(const key of ['data-jrpg-commands','data-jrpg-details','data-jrpg-close',
       'data-jrpg-heading','data-jrpg-message']){
    nodes['['+key+']']=element('div');nodes['['+key+']'].ownerDocument=doc;
  }
  const commands=nodes['[data-jrpg-commands]'],detail=nodes['[data-jrpg-details]'];
  const find=(arr,text)=>arr.find(n=>n.textContent.includes(text));
  return {root,open,doc,commands,detail,nodes,find};
}
function game(){
  const data=Object.create(null);let writes=0;
  const store={read:k=>data[k]||null,write:(k,v)=>{writes++;data[k]=v;return true;}};
  const host=createWorld(store,JSON.parse(JSON.stringify(project)));
  const controls=ui(),visibility=[];
  const menu=createMenu(controls.root,controls.open,{
    project,view:()=>host.view(),dispatch:c=>host.dispatch(c),
    verifySave:()=>host.verifySave(),onVisibility:v=>visibility.push(v)
  });
  return {host,menu,controls,visibility,writes:()=>writes};
}
test('JRPG menu opens from pause and closes without advancing game state or changing slots',()=>{
  const g=game(),prior=JSON.stringify(g.host.view()),count=g.writes();
  assert.equal(g.menu.handle({type:'pause'}),true);
  assert.equal(g.menu.current(),'save');
  assert.equal(g.menu.isOpen(),true);
  assert.equal(g.controls.root.hidden,false);
  assert.ok(g.controls.detail.children.some(x=>x.textContent.includes('Auto-save')));
  assert.equal(g.menu.handle({type:'cancel'}),true);
  assert.equal(g.menu.current(),'overview');
  assert.equal(g.menu.handle({type:'cancel'}),true);
  assert.equal(g.menu.isOpen(),false);
  assert.equal(g.controls.root.hidden,true);
  assert.equal(JSON.stringify(g.host.view()),prior);
  assert.equal(g.writes(),count);
  assert.deepEqual(g.visibility,[true,false]);
});
test('controller handles command selection and blocks any underlying world action while menu is open',()=>{
  const g=game(),before=g.host.view().sequence;
  assert.equal(g.menu.handle({type:'menu'}),true);
  assert.equal(g.menu.handle({type:'navigate',direction:'down'}),true);
  assert.equal(g.menu.handle({type:'confirm'}),true);
  assert.equal(g.menu.current(),'techniques');
  assert.ok(g.controls.detail.children.some(x=>String(x.textContent).includes('MP')));
  assert.equal(g.menu.handle({type:'navigate',direction:'left'}),true);
  assert.equal(g.menu.current(),'overview');
  assert.equal(g.menu.handle({type:'map'}),true);
  assert.equal(g.host.view().sequence,before);
});
test('equipment actions are canonical and auto-save before party UI updates',()=>{
  const g=game();
  assert.equal(g.host.navigate('right').ok,true);
  assert.equal(g.host.dispatch({type:'choose',id:'collect'}).ok,true);
  assert.equal(g.menu.open('equipment'),true);
  const equip=g.controls.detail.children.find(n=>n.textContent==='Equip Training blade');
  assert.ok(equip,'real inventory item must be offered to real actor');
  const before=g.host.view().sequence;
  equip.click();
  assert.equal(g.host.view().sequence,before+1);
  assert.equal(g.host.view().partyGear.pilot.weapon,'blade');
  assert.equal(g.host.verifySave().ok,true);
  assert.equal(g.menu.current(),'equipment');
  assert.equal(g.controls.nodes['[data-jrpg-message]'].textContent,'Action saved.');
});
test('menu refuses opening during battle or unresolved conversations',()=>{
  const g=game();g.host.navigate('right');
  assert.equal(g.menu.open(),false);
  assert.equal(g.menu.isOpen(),false);
  assert.equal(g.menu.handle({type:'menu'}),false);
});
test('options only affect display, not RPG state, and touch commands are populated',()=>{
  const g=game(),before=g.writes(),v=JSON.stringify(g.host.view());
  g.controls.open.click();assert.equal(g.menu.isOpen(),true);
  g.controls.find(g.controls.commands.children,'Options').click();
  let toggle=g.controls.find(g.controls.detail.children,'Hide touch D-pad');
  assert.ok(toggle);toggle.click();
  assert.equal(g.controls.doc.body.classList.contains('jrpg-pad-hidden'),true);
  toggle=g.controls.find(g.controls.detail.children,'Show touch D-pad');
  assert.ok(toggle);toggle.click();
  assert.equal(g.controls.doc.body.classList.contains('jrpg-pad-hidden'),false);
  assert.equal(g.writes(),before);assert.equal(JSON.stringify(g.host.view()),v);
});
test('long inventories are paged rather than clipped and inaccessible',()=>{
  const t=ui();const items={};const inventory={};
  for(let i=0;i<22;i++){const id='item'+i;items[id]={name:'Item '+i,kind:'key'};inventory[id]=1;}
  const view={map:'sample',mapName:'Large inventory',sequence:1,quests:{},inventory,
    partyActors:[],hp:10,maxHp:10};
  const menu=createMenu(t.root,t.open,{project:{items,quests:{}},view:()=>view,
    dispatch:()=>({ok:false,reason:'no-change'}),verifySave:()=>({ok:true,revision:1}),
    onVisibility:()=>{}});
  assert.equal(menu.open('items'),true);
  const page=t.detail.children.find(n=>n.className==='jrpg-pages');
  assert.ok(page,'page buttons required when item count exceeds seven');
  assert.equal(t.detail.children.filter(n=>!n.hidden&&n.className==='jrpg-entry').length,7);
  page.children[1].click();
  assert.equal(t.detail.children.filter(n=>!n.hidden&&n.className==='jrpg-entry').length,7);
  assert.equal(t.detail.children[0].hidden,true);
  assert.ok(t.detail.children[7].textContent.includes('Item'));
});
test('Android source wires JRPG menu while preserving original developer diagnostics for test routes',()=>{
  const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
  const html=read('enginehost/index.html'),boot=read('enginehost/boot.js');
  assert.match(html,/id="jrpg-menu"/);
  assert.match(html,/data-jrpg-commands/);
  assert.match(html,/src="jrpg-menu\.js"/);
  assert.match(boot,/createBearframeJRPGMenu\(/);
  assert.match(boot,/partyWorldInput=createBearframeWorldInput\(/);
  assert.match(boot,/,jrpgMenu\);/);
  assert.match(boot,/partyWorldButtons\.forEach\(function\(button\)\{button\.disabled=locked\|\|jrpgMenu\.isOpen\(\);\}\);/);
  assert.match(read('enginehost/host.css'),/jrpg-menu\[hidden\]/);
  assert.match(read('enginehost/host.css'),/jrpg-pad-hidden/);
  assert.match(read('android/build.sh'),/enginehost\/\*\.js/);
});

test('Android CI explicitly exercises the visible JRPG command modal and saved equipment',()=>{
  const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
  const java=read('android/test/RouteRunner.java');
  const workflow=read('.github/workflows/engine-ci.yml');
  for(const token of [
    'checkUnifiedJrpgMenu()', 'stage.equals("unified-jrpg-menu")',
    "BearframeHost.jrpgMenu", "m.open('equipment')",
    "Equip Training blade", "getComputedStyle(overlay)",
    "h.verifySave().ok", "h.view().sequence===before+3"
  ])assert.ok(java.includes(token),'Android menu acceptance missing '+token);
  assert.match(workflow,/stage unified-jrpg-menu/);
  assert.match(workflow,/route=PASS unified-jrpg-menu/);
});

test('controller keeps a live Options action focused after its button is replaced',()=>{
  const g=game();
  assert.equal(g.menu.open('options'),true);
  assert.equal(g.menu.handle({type:'navigate',direction:'right'}),true);
  assert.equal(g.controls.doc.activeElement.textContent,'Hide touch D-pad');
  const before=g.writes();
  assert.equal(g.menu.handle({type:'confirm'}),true);
  assert.equal(g.controls.doc.body.classList.contains('jrpg-pad-hidden'),true);
  assert.equal(g.controls.doc.activeElement.textContent,'Show touch D-pad');
  assert.equal(g.menu.handle({type:'confirm'}),true);
  assert.equal(g.controls.doc.body.classList.contains('jrpg-pad-hidden'),false);
  assert.equal(g.controls.doc.activeElement.textContent,'Hide touch D-pad');
  assert.equal(g.writes(),before,'display-only actions must never save RPG progress');
});

test('controller can turn every inventory page without focusing disabled pager buttons',()=>{
  const t=ui(),items={},inventory={};
  for(let i=0;i<22;i++){
    const id='item'+i;
    items[id]={name:'Item '+i,kind:'key'};inventory[id]=1;
  }
  const view={map:'sample',sequence:1,quests:{},inventory,
    partyActors:[],hp:10,maxHp:10};
  const menu=createMenu(t.root,t.open,{project:{items,quests:{}},view:()=>view,
    dispatch:()=>{throw Error('paging must not dispatch gameplay');},
    verifySave:()=>({ok:true,revision:1}),onVisibility:()=>{}});
  assert.equal(menu.open('items'),true);
  assert.equal(menu.handle({type:'navigate',direction:'right'}),true);
  assert.equal(t.doc.activeElement.textContent,'Next ▶');
  for(let page=1;page<=3;page++){
    assert.equal(menu.handle({type:'confirm'}),true);
    assert.ok(t.detail.children[page*7].hidden===false);
  }
  assert.equal(t.doc.activeElement.textContent,'◀ Previous',
    'last page must redirect focus off newly disabled Next');
  assert.equal(menu.handle({type:'confirm'}),true);
  assert.equal(t.doc.activeElement.textContent,'◀ Previous');
  assert.equal(menu.handle({type:'navigate',direction:'down'}),true);
  assert.equal(t.doc.activeElement.textContent,'Next ▶');
  assert.equal(view.sequence,1);
});

test('Pause while menu is open selects and focuses the actual Save command',()=>{
  const g=game();
  assert.equal(g.menu.open('options'),true);
  assert.equal(g.menu.handle({type:'navigate',direction:'right'}),true);
  assert.equal(g.menu.handle({type:'pause'}),true);
  assert.equal(g.menu.current(),'save');
  assert.equal(g.controls.doc.activeElement.textContent,'Save');
});

test('detached JRPG equipment controls cannot dispatch after a section switch or close',()=>{
  const g=game();
  assert.equal(g.host.navigate('right').ok,true);
  assert.equal(g.host.dispatch({type:'choose',id:'collect'}).ok,true);
  assert.equal(g.menu.open('equipment'),true);
  const stale=g.controls.detail.children.find(n=>n.textContent==='Equip Training blade');
  assert.ok(stale);
  const before=g.host.view().sequence,writes=g.writes();
  g.controls.commands.children.find(n=>n.textContent==='Options').click();
  stale.click();
  assert.equal(g.host.view().sequence,before);
  assert.equal(g.writes(),writes);
  g.menu.close();
  stale.click();
  assert.equal(g.host.view().sequence,before);
  assert.equal(g.writes(),writes);
});

test('hidden inventory-page actions cannot dispatch until their page is visible',()=>{
  const t=ui(),items={},inventory={};let dispatches=0;
  for(let i=0;i<10;i++){
    const id='potion'+i;
    items[id]={name:'Potion '+i,kind:'consumable'};inventory[id]=1;
  }
  const view={map:'test',sequence:1,quests:{},inventory,partyActors:[],hp:5,maxHp:10};
  const menu=createMenu(t.root,t.open,{project:{items,quests:{}},view:()=>view,
    dispatch:()=>{dispatches++;return {ok:false,reason:'test'};},
    verifySave:()=>({ok:true,revision:1}),onVisibility:()=>{}});
  assert.equal(menu.open('items'),true);
  const action=t.detail.children.find(n=>n.textContent==='Use Potion 0');
  assert.ok(action);
  const pager=t.detail.children.find(n=>n.className==='jrpg-pages');
  assert.ok(pager);
  pager.children[1].click();
  assert.equal(action.hidden,true);
  action.click();
  assert.equal(dispatches,0);
  pager.children[0].click();
  action.click();
  assert.equal(dispatches,1);
  assert.equal(view.sequence,1);
});
