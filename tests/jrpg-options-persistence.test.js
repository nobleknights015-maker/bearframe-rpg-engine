'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const createMenu=require('../enginehost/jrpg-menu');
const createPrefs=require('../framework/ui-preferences');
function dom(){
  const nodes={};let doc;
  function element(tag){
    const listeners={},attrs={};
    const el={ownerDocument:doc,tagName:tag.toUpperCase(),textContent:'',
      className:'',hidden:false,disabled:false,children:[],
      appendChild(n){this.children.push(n);n.parentNode=this;return n;},
      removeChild(n){this.children.splice(this.children.indexOf(n),1);n.parentNode=null;return n;},
      get firstChild(){return this.children[0]||null;},
      setAttribute(k,v){attrs[k]=String(v);},
      getAttribute:k=>attrs[k]||null,
      addEventListener(k,fn){(listeners[k]||(listeners[k]=[])).push(fn);},
      click(){if(!this.disabled)(listeners.click||[]).forEach(f=>f());},
      focus(){doc.activeElement=this;},
      querySelector:k=>nodes[k]||null};
    return el;
  }
  const classes=new Set();
  doc={activeElement:null,body:{classList:{
    toggle(k,v){v?classes.add(k):classes.delete(k);},
    contains:k=>classes.has(k)}},createElement:tag=>element(tag)};
  const root=element('section'),open=element('button');
  for(const key of ['data-jrpg-commands','data-jrpg-details',
    'data-jrpg-close','data-jrpg-heading','data-jrpg-message'])
    nodes['['+key+']']=element('div');
  return {root,open,doc,nodes,details:nodes['[data-jrpg-details]'],
    message:nodes['[data-jrpg-message]'],
    action:text=>nodes['[data-jrpg-details]'].children.find(n=>n.textContent===text)};
}
function setup(d,projectId){
 const prefs=createPrefs(d.storage,projectId),ui=dom();
 const v={map:'hub',mapName:'Safe room',x:1,y:1,hp:12,maxHp:12,
   quests:{},inventory:{},partyActors:[],sequence:4};
 const audioState={available:true,enabled:false,muted:prefs.snapshot().muted,
   volumes:{...prefs.snapshot().volumes}};
 const hits=[];
 const audio={
   status:()=>({...audioState,volumes:{...audioState.volumes}}),
   signal:()=>Promise.resolve({ok:true}),
   enable:()=>{audioState.enabled=true;return Promise.resolve({ok:true});},
   disable:()=>{audioState.enabled=false;},
   mute:value=>{hits.push('mute:'+value);audioState.muted=value;return Promise.resolve({ok:true});},
   volume:(bus,value)=>{hits.push('volume:'+bus+':'+value);audioState.volumes[bus]=value;
      return Promise.resolve({ok:true});}
 };
 const menu=createMenu(ui.root,ui.open,{view:()=>v,project:{items:{},quests:{}},
   verifySave:()=>({ok:true,revision:4}),dispatch:()=>({ok:false}),
   onVisibility:()=>{},preferences:prefs,audio});
 menu.open('options');
 return {prefs,menu,ui,audio,audioState,hits,v};
}
function storage(){
 let fail=false,writes=0;const data=new Map();
 return {data,storage:{read:k=>data.has(k)?data.get(k):null,
   write:(k,v)=>{writes++;if(fail)return false;data.set(k,v);return true;}},
   setFail:v=>fail=v,writes:()=>writes};
}
test('JRPG options commit D-pad and reduced-motion settings outside game save',()=>{
 const d=storage(),g=setup(d,'ui_menu');
 const before=JSON.stringify(g.v);
 g.ui.action('Hide touch D-pad').click();
 assert.equal(g.prefs.snapshot().showPad,false);
 assert.equal(g.ui.doc.body.classList.contains('jrpg-pad-hidden'),true);
 g.ui.action('Reduce transition animations').click();
 assert.equal(g.prefs.snapshot().reducedMotion,true);
 assert.equal(g.ui.doc.body.classList.contains('jrpg-reduced-motion'),true);
 assert.equal(g.prefs.snapshot().sequence,2);
 assert.equal(JSON.stringify(g.v),before);
 assert.ok([...d.data.keys()].every(k=>k.startsWith('bf:ui:ui_menu:v1:')));
});
test('saved settings immediately restore display classes after new UI construction',()=>{
 const d=storage(),one=setup(d,'ui_menu');
 one.ui.action('Hide touch D-pad').click();
 one.ui.action('Reduce transition animations').click();
 one.menu.close();
 const next=setup(d,'ui_menu');
 assert.equal(next.prefs.snapshot().sequence,2);
 assert.equal(next.ui.doc.body.classList.contains('jrpg-pad-hidden'),true);
 assert.equal(next.ui.doc.body.classList.contains('jrpg-reduced-motion'),true);
 assert.ok(next.ui.action('Show touch D-pad'));
 assert.ok(next.ui.action('Enable transition animations'));
});
test('audio mute and bus controls write preferences before changing playback',()=>{
 const d=storage(),g=setup(d,'audio_menu');
 g.ui.action('Mute').click();
 assert.equal(g.prefs.snapshot().muted,true);
 assert.equal(g.audioState.muted,true);
 const original=g.prefs.snapshot().volumes.master;
 g.ui.action('Master −').click();
 assert.equal(g.prefs.snapshot().volumes.master,original-10);
 assert.equal(g.audioState.volumes.master,original-10);
 assert.ok(g.hits.includes('mute:true'));
 assert.ok(g.hits.includes('volume:master:90'));
 assert.equal(JSON.stringify(g.v),JSON.stringify({...g.v}));
});
test('failed setting journal write prevents UI, sound changes and fake save success',()=>{
 const d=storage(),g=setup(d,'failure_case');
 const prior=g.prefs.snapshot();
 d.setFail(true);
 g.ui.action('Hide touch D-pad').click();
 assert.deepEqual(g.prefs.snapshot(),prior);
 assert.equal(g.ui.doc.body.classList.contains('jrpg-pad-hidden'),false);
 assert.match(g.ui.message.textContent,/Could not save display setting/);
 g.ui.action('Mute').click();
 assert.equal(g.audioState.muted,false);
 assert.equal(g.prefs.snapshot().muted,false);
 assert.match(g.ui.message.textContent,/Could not save audio setting/);
 assert.equal(g.hits.length,0);
});
test('actual WebView wiring restores audio levels before any playback',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const boot=read('enginehost/boot.js'),menu=read('enginehost/jrpg-menu.js');
 assert.match(read('enginehost/index.html'),/src="\.\.\/framework\/ui-preferences\.js"/);
 assert.match(boot,/createBearframeUiPreferences\(storage,partyWorldProject\.id\)/);
 assert.match(boot,/gameAudio\.volume\(bus,savedSettings\.volumes\[bus\]\)/);
 assert.match(boot,/gameAudio\.mute\(savedSettings\.muted\)/);
 assert.match(boot,/preferences:userSettings/);
 assert.match(menu,/persistDisplay\('showPad',!showPad\)/);
 assert.match(menu,/persistAudio\('muted',!audio\.muted\)/);
 assert.match(menu,/persistAudio\('volumes',next,bus\)/);
});
test('Android must test UI settings with full force-stop/restart and unchanged RPG save',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const java=read('android/test/RouteRunner.java'),
   ci=read('.github/workflows/engine-ci.yml');
 for(const phrase of ['checkUnifiedUiPreferences(boolean restart)',
   'stage.equals("unified-ui-settings-first")',
   'stage.equals("unified-ui-settings-second")',
   "tap('Hide touch D-pad')",
   "tap('Reduce transition animations')",
   'h.verifySave().ok',
   "sound.enabled",
   "p.snapshot()"])
   assert.ok(java.includes(phrase),'Missing installed settings acceptance '+phrase);
 assert.match(ci,/stage unified-ui-settings-first/);
 assert.match(ci,/stage unified-ui-settings-second/);
 assert.match(ci,/am force-stop dev\.bearframe\.ridge/);
});
