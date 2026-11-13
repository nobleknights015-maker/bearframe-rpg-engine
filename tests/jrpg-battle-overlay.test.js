'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const make=require('../enginehost/party-ui');
function dom(){
  const doc={createElement:tag=>node(tag)};
  function node(tag){
    const attrs={},handlers={},children=[];
    const o={tagName:tag.toUpperCase(),ownerDocument:doc,
      className:'',id:'',textContent:'',disabled:false,children,handlers,
      appendChild(n){children.push(n);return n;},
      removeChild(n){const i=children.indexOf(n);if(i>=0)children.splice(i,1);return n;},
      setAttribute(k,v){attrs[k]=String(v);},
      getAttribute:k=>attrs[k]||null,
      addEventListener:k=>{},
      click(){if(!this.disabled&&handlers.click)handlers.click();}
    };
    o.addEventListener=(k,fn)=>handlers[k]=fn;
    Object.defineProperty(o,'firstChild',{get:()=>children[0]||null});
    if(tag==='select'){
      let chosen=null;
      Object.defineProperty(o,'value',{get:()=>chosen===null?(children[0]?.value||''):chosen,
        set:value=>{chosen=value;}});
    }
    return o;
  }
  return doc.createElement('div');
}
function battle(){
 const actor=(id,name,hp,maxHp,mp,maxMp,skills,statuses)=>({
   id,name,hp,maxHp,mp,maxMp,skills,statuses:statuses||[]});
 return {turn:3,phase:'active',
   party:[actor('pilot','Pilot',18,25,3,5,['strike','mend','guard'],[{type:'poison'}]),
     actor('scout','Scout',20,20,1,2,['strike','guard'])],
   foes:[actor('crawler','Crawler',13,28,0,0,['strike']),
     actor('sentinel','Sentinel',26,26,0,0,['strike'])],
   log:['Pilot hits Crawler for 9.','Sentinel hits Pilot for 4.']};
}
const skills={strike:{kind:'damage',cost:0},mend:{kind:'heal',cost:1},
  guard:{kind:'guard',cost:0}};
const deepClone=x=>JSON.parse(JSON.stringify(x));
test('JRPG arena shows canonical enemy HP, ally HP/MP, statuses and recent combat log',()=>{
 const root=dom(),state=battle(),before=JSON.stringify(state);
 const panel=make(root,{battle:()=>deepClone(state),submit:()=>({ok:false})},skills);
 panel.render();
 const arena=root.children[0];
 assert.equal(arena.className,'jrpg-battle-stage');
 const [scene,party,log]=arena.children;
 assert.equal(scene.children[0].textContent,'BATTLE · ROUND 3');
 assert.equal(scene.children[1].children.length,2);
 assert.deepEqual(scene.children[1].children.map(n=>n.getAttribute('data-battle-actor')),
   ['crawler','sentinel']);
 assert.equal(party.children.length,2);
 assert.equal(party.children[0].getAttribute('data-battle-actor'),'pilot');
 assert.ok(party.children[0].children.some(n=>n.className==='jrpg-battle-status'&&n.textContent==='poison'));
 assert.match(log.textContent,/Sentinel hits Pilot for 4/);
 assert.equal(JSON.stringify(state),before,'combat presentation must never mutate simulation');
});
test('target selection honors real skill kind and refuses dead/completed targets',()=>{
 const root=dom(),state=battle(),submissions=[];
 const probe={battle:()=>deepClone(state),submit:orders=>{
   submissions.push(orders);return {ok:true};
 }};
 const panel=make(root,probe,skills);panel.render();
 const pilot=root.children.find(n=>n.className.includes('jrpg-battle-actions'));
 const skill=pilot.children.find(n=>n.tagName==='LABEL').children[0],
   target=pilot.children.filter(n=>n.tagName==='LABEL')[1].children[0];
 assert.equal(target.value,'crawler');
 skill.value='mend';skill.handlers.change();
 assert.equal(target.value,'pilot');
 assert.equal(target.children.length,2);
 skill.value='guard';skill.handlers.change();
 assert.equal(target.value,'pilot');
 assert.equal(target.disabled,true);
 skill.value='strike';skill.handlers.change();
 assert.equal(target.disabled,false);
 root.children.find(n=>n.id==='party-commit').click();
 assert.equal(submissions.length,1);
 assert.deepEqual(submissions[0],[{actor:'pilot',skill:'strike',target:'crawler'},
   {actor:'scout',skill:'strike',target:'crawler'}]);
});
test('defeated allies are present in roster but do not receive turn orders',()=>{
 const root=dom(),state=battle(),selected=[];
 state.party[1].hp=0;
 const panel=make(root,{battle:()=>deepClone(state),submit:orders=>{
   selected.push(...orders);return {ok:true};}},skills);
 panel.render();
 assert.equal(root.children[0].children[1].children.length,2);
 assert.equal(root.children.filter(n=>n.className.includes('jrpg-battle-actions')).length,1);
 root.children.find(n=>n.id==='party-commit').click();
 assert.equal(selected.length,1);
 assert.equal(selected[0].actor,'pilot');
});
test('battle overlay fits landscape stage and keeps canonical equipment/turn gate intact',()=>{
 const get=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const css=get('enginehost/host.css'),src=get('enginehost/party-ui.js');
 assert.match(css,/data-phase="battle"/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) minmax\(235px,35%\)/);
 assert.match(css,/jrpg-battle-stage/);
 assert.match(css,/party-commit/);
 assert.match(css,/\[data-engine-page-hidden\]/);
 assert.match(src,/var result=probe\.submit\(orders\)/);
 assert.match(src,/if\(!handled\)render\(\)/);
 assert.match(get('enginehost/boot.js'),/partyWorld\.submit\(orders\)/);
});

test('installed Android WebView checks fitted battle arena before submitting turn',()=>{
 const get=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const java=get('android/test/RouteRunner.java');
 const ci=get('.github/workflows/engine-ci.yml');
 for(const phrase of ["getComputedStyle(panel).display!=='grid'",
   ".jrpg-battle-stage", ".jrpg-battle-foe", ".jrpg-battle-member",
   "[data-party-skill]", "[data-party-target]", "confirm.getClientRects().length"])
   assert.ok(java.includes(phrase),'Missing installed battle visual acceptance: '+phrase);
 assert.match(ci,/stage unified-party-world-ui-first/);
 assert.match(ci,/stage unified-party-world-ui-second/);
});
