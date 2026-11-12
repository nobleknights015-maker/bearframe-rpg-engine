const test=require('node:test'),assert=require('node:assert/strict');
const make=require('../enginehost/landscape-layout');
const pager=require('../enginehost/landscape-pager');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function classList(){
 const set=new Set();
 return {toggle:(x,b)=>b?set.add(x):set.delete(x),contains:x=>set.has(x)};
}
function layoutHarness(){
 const events={};
 const win={innerWidth:917,innerHeight:411,addEventListener:(n,f)=>events[n]=f,
   getComputedStyle:()=>({paddingTop:'12px',paddingRight:'18px',
    paddingBottom:'8px',paddingLeft:'22px'})};
 const doc={defaultView:win,body:{classList:classList(),appendChild(){}},
  documentElement:{classList:classList()},getElementById:()=>null,
  createElement:()=>({setAttribute(){},className:''})};
 const stage={ownerDocument:doc,style:{}};
 return {layout:make(stage,win),doc,win,events,stage};
}
test('Engine v1 landscape transform letterboxes every aspect and safe-area profile',()=>{
 const h=layoutHarness();
 for(const [w,height] of [[917,411],[640,360],[742,360],[1920,1080],[1024,768],[390,844],[3200,900],[900,1600]]){
  const fit=h.layout.fit(w,height,{left:22,right:18,top:12,bottom:8});
  assert.ok(fit.scale>0);
  assert.ok(fit.offsetX>=22-1e-6);
  assert.ok(fit.offsetY>=12-1e-6);
  assert.ok(fit.offsetX+fit.stageWidth*fit.scale<=w-18+1e-6);
  assert.ok(fit.offsetY+fit.stageHeight*fit.scale<=height-8+1e-6);
  assert.ok(fit.stageWidth>=800&&fit.stageHeight>=450,
    'Engine v1 adaptive stage never shrinks below its logical baseline');
  if(w>=height){
    assert.ok(Math.abs(fit.stageWidth*fit.scale-fit.safeArea.width)<1,
      'landscape stage uses full usable width instead of letterboxing');
    assert.ok(Math.abs(fit.stageHeight*fit.scale-fit.safeArea.height)<1,
      'landscape stage uses full usable height');
  }
 }
 assert.ok(h.layout.fit(3200,900,{left:0,right:0,top:0,bottom:0}).stageWidth>1280,
   'ultrawide devices must not hit an artificial logical-width cap');
 assert.ok(h.layout.fit(900,1600,{left:0,right:0,top:0,bottom:0}).stageHeight>720,
   'narrow viewports must not hit an artificial logical-height cap');
 assert.equal(h.layout.snapshot().width,917);
 assert.ok(h.layout.snapshot().stageWidth>800,
   'ultrawide screen expands the logical stage instead of wasting side margins');
 assert.equal(h.stage.style.width,h.layout.snapshot().stageWidth+'px');
 assert.equal(h.doc.body.classList.contains('landscape-gameplay'),true);
 assert.equal(h.doc.documentElement.classList.contains('landscape-gameplay'),true);
 assert.match(h.stage.style.transform,/translate\([\d.]+px,[\d.]+px\) scale\([\d.]+\)/);
 h.layout.setDebug(true);
 assert.equal(h.doc.body.classList.contains('landscape-debug'),true);
 assert.equal(h.doc.documentElement.classList.contains('landscape-gameplay'),false);
 h.layout.setDebug(false);
 h.win.innerWidth=1024;h.win.innerHeight=600;h.events.resize();
 assert.equal(h.layout.snapshot().width,1024);
});
function fakeRoot(){
 const doc={createElement(tag){return node(tag.toUpperCase());}};
 function node(tag){
  const n={tagName:tag,children:[],ownerDocument:doc,attrs:{},disabled:false,
   listeners:{},className:'',textContent:'',type:null,
   appendChild(x){this.children.push(x);return x;},
   removeChild(x){this.children.splice(this.children.indexOf(x),1);},
   setAttribute(k,v){this.attrs[k]=v;},
   removeAttribute(k){delete this.attrs[k];},
   hasAttribute(k){return Object.prototype.hasOwnProperty.call(this.attrs,k);},
   querySelector(sel){
    if(sel==='.engine-page-nav')
      return this.children.find(x=>x.className==='engine-page-nav')||null;
    if(sel==='button:not([disabled]),select:not([disabled])')
      return this.children.find(x=>!x.disabled&&
        (x.tagName==='BUTTON'||x.tagName==='SELECT'))||null;
    return null;
   },
   addEventListener(k,fn){this.listeners[k]=fn;},
   focus(){doc.activeElement=this;}};
  n.classList={contains:k=>n.className.split(' ').includes(k)};
  n.click=()=>{if(!n.disabled&&n.listeners.click)n.listeners.click();};
  return n;
 }
 return node('DIV');
}
test('inventory paging exposes every item without scrolling or altering commands',()=>{
 const inventory=fakeRoot(),events=fakeRoot(),battle=fakeRoot();
 for(let i=0;i<9;i++){
  const line=inventory.ownerDocument.createElement('div');
  line.className='inventory-line';line.setAttribute('data-item','item'+i);
  inventory.appendChild(line);
 }
 for(let i=0;i<7;i++){
  const choice=events.ownerDocument.createElement('button');
  choice.setAttribute('data-event-choice','choice'+i);events.appendChild(choice);
 }
 for(let i=0;i<5;i++){
  const actor=battle.ownerDocument.createElement('div');
  actor.className='party-command';battle.appendChild(actor);
 }
 const commit=battle.ownerDocument.createElement('button');
 commit.id='party-commit';battle.appendChild(commit);
 const p=pager({inventory,events,battle});
 assert.deepEqual(p.refresh('inventory',true),{page:1,pages:5,items:9});
 assert.equal(inventory.children.filter(x=>x.className==='inventory-line'&&
  !x.hasAttribute('data-engine-page-hidden')).length,2);
 let nav=inventory.querySelector('.engine-page-nav');nav.children[2].click();
 assert.equal(p.current('inventory'),1);
 assert.equal(inventory.children.filter(x=>x.className==='inventory-line'&&
  !x.hasAttribute('data-engine-page-hidden')).length,2);
 p.refresh('events',true);assert.equal(events.children.filter(x=>
  x.hasAttribute('data-event-choice')&&!x.hasAttribute('data-engine-page-hidden')).length,4);
 const eventNext=events.querySelector('.engine-page-nav').children[2];
 eventNext.focus();eventNext.click();
 assert.equal(p.current('events'),1);
 assert.equal(events.ownerDocument.activeElement,events.children[4],
  'gamepad paging must transfer focus to the next visible dialogue choice');
 assert.equal(events.children[4].hasAttribute('data-engine-page-hidden'),false);
 p.refresh('battle',true);assert.equal(battle.children.filter(x=>
  x.className==='party-command'&&!x.hasAttribute('data-engine-page-hidden')).length,1);
 assert.equal(commit.hasAttribute('data-engine-page-hidden'),false);
 for(let i=0;i<4;i++)battle.querySelector('.engine-page-nav').children[2].click();
 assert.equal(p.current('battle'),4);
 assert.equal(battle.children.filter(x=>x.className==='party-command'&&
  !x.hasAttribute('data-engine-page-hidden')).length,1);
});
test('Android landscape-only Activity, fixed shell and installed geometry gate are present',()=>{
 const manifest=read('android/AndroidManifest.xml'),html=read('enginehost/index.html');
 const css=read('enginehost/host.css'),java=read('android/test/RouteRunner.java');
 const ci=read('.github/workflows/engine-ci.yml');
 assert.match(manifest,/UnifiedEngineActivity" android:exported="false" android:screenOrientation="sensorLandscape"/);
 assert.doesNotMatch(manifest,/ExpeditionActivity"[^>]+screenOrientation/);
 assert.match(html,/id="engine-landscape-stage"/);
 assert.match(html,/landscape-layout\.js/);
 assert.match(html,/landscape-pager\.js/);
 assert.match(css,/overflow:hidden!important/);
 assert.match(css,/data-engine-page-hidden/);
 assert.match(java,/checkLandscapeViewport\(\)/);
 assert.match(ci,/stage unified-landscape/);
});
