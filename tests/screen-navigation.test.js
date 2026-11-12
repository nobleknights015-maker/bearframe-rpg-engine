const test=require('node:test'),assert=require('node:assert/strict');
const make=require('../enginehost/screen-navigation');
function ui(){
 const nodes=Object.create(null);
 for(const name of ['world','party','save']){
  const tab={attrs:{'aria-controls':'pw-'+name},tabIndex:-1,handlers:{},
   addEventListener:(key,cb)=>{tab.handlers[key]=cb;},
   setAttribute:(key,v)=>{tab.attrs[key]=v;},
   getAttribute:(key)=>tab.attrs[key],focus:()=>{tab.focused=true;}};
  const panel={id:'pw-'+name,hidden:false,targets:Object.create(null),
   querySelector:function(sel){return this.targets[sel]||null;}};
  nodes[name]={tab,panel};
 }
 const nav={querySelector:sel=>{
  const m=sel.match(/^\[data-party-world-tab="([^"]+)"\]$/);
  return m&&nodes[m[1]]?nodes[m[1]].tab:null;
 }};
 return {nodes,nav,panels:Object.fromEntries(Object.keys(nodes).map(n=>[n,nodes[n].panel]))};
}
test('tabs are accessible, exclusive and never modify game saves',()=>{
 const fixture=ui(),tab=make(fixture.nav,fixture.panels);
 assert.equal(tab.current(),'world');
 assert.equal(fixture.nodes.world.panel.hidden,false);
 assert.equal(fixture.nodes.party.panel.hidden,true);
 fixture.nodes.party.tab.handlers.click();
 assert.equal(tab.current(),'party');
 assert.equal(fixture.nodes.world.panel.hidden,true);
 assert.equal(fixture.nodes.party.tab.attrs['aria-selected'],'true');
 assert.equal(fixture.nodes.party.tab.tabIndex,0);
 assert.equal(fixture.nodes.world.tab.tabIndex,-1);
 const e={key:'ArrowRight',preventDefault(){this.prevented=true;}};
 fixture.nodes.party.tab.handlers.keydown(e);
 assert.equal(e.prevented,true);
 assert.equal(tab.current(),'save');
 assert.equal(fixture.nodes.save.tab.focused,true);
 assert.equal(tab.sync('explore',true),'save','unrelated render keeps selected tab');
 assert.throws(()=>tab.select('unknown'),/Unknown engine screen/);
});
test('phase transitions surface real dialogue, battle and movement controls',()=>{
 const f=ui(),tab=make(f.nav,f.panels);
 function action(selector){const n={disabled:false,focused:false,
  focus(){this.focused=true;},scrollIntoView(){this.scrolled=true;}};
  f.nodes.world.panel.targets[selector]=n;return n;
 }
 const choice=action('#party-world-events [data-event-choice]');
 const skill=action('#party-world-battle [data-party-skill]');
 const move=action('[data-party-world-dir="down"]');
 tab.select('party');
 tab.sync('event',false);
 assert.equal(tab.current(),'party','asset recovery never changes screen');
 tab.sync('event',true);
 assert.equal(tab.current(),'world');
 assert.equal(choice.focused,true);assert.equal(choice.scrolled,true);
 tab.select('save');
 tab.sync('battle',true);
 assert.equal(tab.current(),'world');assert.equal(skill.focused,true);
 tab.sync('explore',true);
 assert.equal(move.focused,true);
});
test('invalid wiring and phases fail closed',()=>{
 const f=ui();
 f.nodes.party.tab.attrs['aria-controls']='wrong';
 assert.throws(()=>make(f.nav,f.panels),/mismatched engine screen party/);
 const valid=ui(),tab=make(valid.nav,valid.panels);
 assert.throws(()=>tab.sync('loading',true),/Unknown world phase/);
});
test('Android host presents separate screens and native controls',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const get=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const html=get('enginehost/index.html'),boot=get('enginehost/boot.js');
 for(const token of ['role="tablist"','data-party-world-tab="world"',
  'data-party-world-tab="party"','data-party-world-tab="save"',
  'role="tabpanel"','id="party-world-surface"',
  'id="party-world-events"','id="party-world-inventory"',
  'id="party-world-battle"','id="party-world-verify"'])
   assert.ok(html.includes(token),'Missing engine screen UI '+token);
 assert.match(html,/screen-navigation\.js/);
 assert.match(boot,/createBearframeScreenNavigator\(/);
 assert.match(boot,/partyWorldScreens\.sync\(/);
});

test('screen changes notify the visual clock only when selection changes',()=>{
 const f=ui(),seen=[];
 const nav=make(f.nav,f.panels,id=>seen.push(id));
 assert.deepEqual(seen,['world']);
 nav.select('party');nav.select('save');
 nav.sync('explore',true);
 assert.deepEqual(seen,['world','party','save']);
 nav.sync('event',true);
 assert.equal(seen.at(-1),'world');
 const bad=ui();
 assert.throws(()=>make(bad.nav,bad.panels,3),/selection callback/);
});
