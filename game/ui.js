const game=buildEngine({WORLD,FOES,TEXT,ACTIONS}), $=id=>document.getElementById(id);
let state=null;
try{const raw=localStorage.getItem(game.key);state=game.restore(raw);
  if(raw&&!state)$('notice').textContent='The saved expedition could not be read. Awaken to start a new expedition.';
}catch{$('notice').textContent='Storage unavailable. This expedition will last for this session.'}
function persist(){
  try{localStorage.setItem(game.key,JSON.stringify(state));$('notice').textContent=''}
  catch{$('notice').textContent='Save unavailable. Keep this session open.'}
}
function act(type,value){
  const next=game.step(state,{type,value});if(next===state)return;
  state=next;persist();render();
}
function button(label,callback,disabled=false){
  const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.onclick=callback;$('choices').append(b);
}
function render(){
  $('intro').hidden=!!state;$('play').hidden=!state;if(!state)return;
  const s=state,b=s.battle,foe=b&&FOES[b.key];
  $('place').textContent=foe?.name??WORLD[s.area].name;
  $('mode').textContent=b?'Turn '+b.turn:s.flags.met?'Survey complete':'On foot';
  $('stats').textContent=s.name+' · Chassis '+s.hp+'/'+game.hpMax(s)+' · Charge '+s.charge+'/3'+(s.weapon?' · '+(s.weapon==='blade'?'Arc blade':'Coil lance'):'');
  $('story').textContent=s.message;
  $('objective').textContent=b?'Target '+b.hp+'/'+foe.hp+' · '+(b.turn%foe.period===0?'High output incoming':'Standard cycle'):
    (s.flags.met?'Expedition complete':s.area==='pod'?'Find the gallery exit →':s.area==='gallery'?'Cross the gallery to the ridge →':'Find the expedition surveyor')+
    (s.flags.echoAlly?' · Echo ally':'')+(s.flags.gridAlly?' · Crawler escort':'');
  $('choices').replaceChildren();$('pad').hidden=!!(b||s.prompt);
  if(b){for(const [k,title] of [['strike','Strike'],['pulse','Pulse · 1 charge'],['guard','Brace + charge'],['withdraw','Withdraw']])button(title,()=>act('combat',k),k==='pulse'&&!s.charge)}
  else if(s.prompt){for(const [v,title] of ACTIONS[s.prompt])button(title,()=>act('choose',v));button('Step back',()=>act('close'))}
  else if(WORLD[s.area].rows[s.y][s.x]==='P')button('Rest at berth',()=>act('rest'));
  paint(document.querySelector('canvas'),s);
}
$('create').onsubmit=e=>{e.preventDefault();state=game.fresh($('callsign').value,$('finish').value);persist();render()};
document.querySelectorAll('[data-dir]').forEach(b=>b.onclick=()=>act('move',b.dataset.dir));
window.addEventListener('keydown',e=>{
  const dir={ArrowRight:'right',ArrowLeft:'left',ArrowUp:'up',ArrowDown:'down'}[e.key];
  if(state&&dir){e.preventDefault();act('move',dir)}
});
render();

for(const img of Object.values(scenery))img.addEventListener('load',()=>{if(state)paint(document.querySelector('canvas'),state)});
