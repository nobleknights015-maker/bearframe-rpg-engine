// Pure simulation. The renderer, input device and host storage cannot mutate live state.
function buildEngine({WORLD,FOES,TEXT,ACTIONS}){
  const weapons=['blade','lance'], finishes=['Ash','Slate','Ivory'];
  const flags=['bearing','E','D','H','echoAlly','gridAlly','met'];
  const key='bf-sleeper-v1';
  const copy=s=>JSON.parse(JSON.stringify(s));
  const cell=(area,x,y)=>WORLD[area]?.rows[y]?.[x];
  const hpMax=s=>s.flags.bearing?36:30;
  function fresh(name,finish='Ash'){
    const callsign=String(name??'').trim().slice(0,18).trim()||'Sleeper';
    if(!finishes.includes(finish)) throw Error('Unknown finish');
    return {v:1,name:callsign,finish,area:'pod',x:3,y:4,hp:30,charge:2,weapon:null,
      flags:flags.reduce((out,f)=>{out[f]=false;return out;},{}),battle:null,prompt:null,
      message:'A violet line finds its way across your visor. You can move. The name you had before is gone.'};
  }
  function encounter(s,k){
    s.prompt=null;s.battle={key:k,hp:FOES[k].hp,turn:1};
    s.message=FOES[k].name+' turns to face you.';
  }
  function step(state,command){
    const s=copy(state), {type,value}=command;
    if(s.battle){
      const b=s.battle,f=FOES[b.key];
      if(type!=='combat'||!['strike','pulse','guard','withdraw'].includes(value))return state;
      if(value==='withdraw'){s.battle=null;s.message='You break contact and hold your ground.';return s}
      if(value==='pulse'&&s.charge===0)return state;
      const ally=(s.flags.echoAlly?2:0)+(s.flags.gridAlly?1:0);
      const base=s.weapon==='blade'?8:s.weapon==='lance'?7:5;
      const damage=(value==='guard'?0:value==='pulse'?base+7:base)+ally;
      if(value==='pulse')s.charge--;
      if(value==='guard')s.charge=Math.min(3,s.charge+1);
      b.hp=Math.max(0,b.hp-damage);
      if(!b.hp){s.flags[b.key]=true;s.battle=null;s.message=f.name+' disengages. The path is clear.';return s}
      const burst=b.turn%f.period===0;
      const incoming=Math.max(1,f.power+(burst?4:0)-(value==='guard'?6:0)-(s.flags.bearing?1:0));
      s.hp=Math.max(0,s.hp-incoming);b.turn++;
      s.message='You deal '+damage+' damage. '+f.name+' deals '+incoming+'.';
      if(!s.hp){s.battle=null;s.area='pod';s.x=3;s.y=4;s.hp=hpMax(s);s.charge=2;
        s.message='Your drive cuts out. You regain movement at the chamber berth. The core remains sealed.'}
      return s;
    }
    if(s.prompt){
      if(type==='close'){s.prompt=null;return s}
      const k=s.prompt;
      if(type!=='choose'||!ACTIONS[k].some(([v])=>v===value))return state;
      s.prompt=null;
      if(value==='fight'||value==='challenge'){encounter(s,k);return s}
      if(value==='fit'){if(!s.flags.bearing)s.hp+=6;s.flags.bearing=true;s.message='Legacy bearing seated. Chassis integrity capacity is 36.'}
      if(weapons.includes(value)){s.weapon=value;s.message=value==='blade'?'Arc blade equipped.':'Coil lance equipped.'}
      if(value==='invite'){s.flags.E=s.flags.echoAlly=true;s.message='The Echo steps beside you. “I can watch your blind side.”'}
      if(value==='escort'){s.flags.D=s.flags.gridAlly=true;s.message='Escort request accepted. The crawler falls into step.'}
      if(value==='inspect')s.message='Modern coupling rejected. Your chassis and core are unchanged.';
      if(value==='listen')s.message='“Take the drainage gallery. The roof there still holds.” The Guardian stays at its post.';
      if(value==='name'||value==='private'){s.flags.met=true;s.message=value==='name'?'Mira records your chosen name: '+s.name+'.':'Mira closes the record. “You can tell me another day.”';s.message+=' Her team resumes the ridge survey. Expedition complete.'}
      return s;
    }
    if(type==='rest'&&cell(s.area,s.x,s.y)==='P'){s.hp=hpMax(s);s.charge=3;s.message='Actuators cooled. Your chassis is ready.';return s}
    if(type!=='move')return state;
    const dir={up:[0,-1],left:[-1,0],down:[0,1],right:[1,0]}[value];
    if(!Array.isArray(dir))return state;
    const x=s.x+dir[0],y=s.y+dir[1],tile=cell(s.area,x,y);
    if(!tile||tile==='#')return state;
    if(tile==='>'&&s.area==='gallery'&&!s.flags.H){s.message='The Hollow still controls the ridge exit.';return s}
    const exit=WORLD[s.area].exits[tile];
    if(exit){[s.area,s.x,s.y]=exit;s.message=WORLD[s.area].name;return s}
    if(TEXT[tile]&&!s.flags[tile]&&!(tile==='M'&&s.flags.met)){
      s.prompt=tile;s.message=TEXT[tile];return s
    }
    s.x=x;s.y=y;
    if(tile==='P')s.message='Stasis berth. Rest here to recover chassis integrity and charge.';
    return s;
  }
  function restore(raw){
    try{
      const s=JSON.parse(raw);
      const between=(n,lo,hi)=>Number.isInteger(n)&&n>=lo&&n<=hi;
      if(!s||s.v!==1||typeof s.name!=='string'||!s.name.trim()||s.name.length>18||
        !finishes.includes(s.finish)||!(s.weapon===null||weapons.includes(s.weapon))||
        !Object.prototype.hasOwnProperty.call(WORLD,s.area)||!between(s.y,0,WORLD[s.area].rows.length-1)||
        !between(s.x,0,WORLD[s.area].rows[s.y].length-1)||cell(s.area,s.x,s.y)==='#'||
        !flags.every(k=>typeof s.flags?.[k]==='boolean')||!between(s.hp,1,hpMax(s))||
        !between(s.charge,0,3)||typeof s.message!=='string'||s.message.length>1000||
        !(s.prompt===null||Object.prototype.hasOwnProperty.call(ACTIONS,s.prompt)))return null;
      if(s.battle!==null&&(!Object.prototype.hasOwnProperty.call(FOES,s.battle?.key)||s.prompt!==null||
        !between(s.battle.hp,1,FOES[s.battle.key].hp)||!between(s.battle.turn,1,Number.MAX_SAFE_INTEGER)))return null;
      if(s.flags.echoAlly&&!s.flags.E||s.flags.gridAlly&&!s.flags.D)return null;
      return s;
    }catch{return null}
  }
  return {fresh,step,restore,hpMax,key,finishes};
}
if(typeof module!=='undefined')module.exports=buildEngine;
