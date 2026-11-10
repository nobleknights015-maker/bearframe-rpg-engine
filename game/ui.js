validateWorldContent({WORLD,FOES,TEXT,ACTIONS});
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


// WebView/browser controller bridge. Gamepad is an optional input source:
// touch and keyboard remain fully functional without a connected controller.
const webGamepadInput=createBearframeControllerInput();
let webControllerSelection=0;
function webChoices(){
  return Array.from(document.querySelectorAll('#choices button')).filter(b=>!b.disabled);
}
function webSelectChoice(delta){
  const choices=webChoices();if(!choices.length)return false;
  const focused=choices.indexOf(document.activeElement);
  if(focused>=0)webControllerSelection=focused;
  webControllerSelection=(webControllerSelection+delta+choices.length)%choices.length;
  choices[webControllerSelection].focus({preventScroll:true});
  return true;
}
function webControllerAction(event){
  if(!state){
    const controls=Array.from(document.querySelectorAll('#create input,#create select,#create button'));
    if(event.type==='navigate'&&controls.length){
      const current=controls.indexOf(document.activeElement);
      const step=event.direction==='up'||event.direction==='left'?-1:1;
      const next=(current<0?(step>0?-1:0):current)+step;
      controls[(next+controls.length)%controls.length].focus({preventScroll:true});
    }else if(event.type==='confirm'&&document.activeElement?.click&&
      ['BUTTON','SELECT'].includes(document.activeElement.tagName)){
      document.activeElement.click();
    }
    return;
  }
  const choices=webChoices();
  if(event.type==='navigate'){
    if(choices.length){
      webSelectChoice(event.direction==='up'||event.direction==='left'?-1:1);
    }else act('move',event.direction);
  }else if(event.type==='confirm'&&choices.length){
    const index=choices.indexOf(document.activeElement);
    choices[index>=0?index:Math.min(webControllerSelection,choices.length-1)].click();
    webControllerSelection=0;
  }else if(event.type==='cancel'){
    if(state.prompt)act('close','');
    else if(state.battle)act('combat','withdraw');
  }
  // Start/Select/shoulders are reserved for menus and party controls in the
  // unified engine; no nonfunctional UI is shown in the frozen prototype.
}
function pollWebGamepads(time){
  let connected=null;
  try{
    const pads=navigator.getGamepads?.()||[];
    for(const pad of pads)if(pad?.connected){connected=pad;break;}
  }catch{}
  const events=webGamepadInput.poll(connected,time);
  for(const event of events)webControllerAction(event);
  requestAnimationFrame(pollWebGamepads);
}
window.addEventListener('blur',()=>webGamepadInput.clear());
document.addEventListener('visibilitychange',()=>{if(document.hidden)webGamepadInput.clear()});
if(typeof navigator.getGamepads==='function'&&typeof requestAnimationFrame==='function')
  requestAnimationFrame(pollWebGamepads);
