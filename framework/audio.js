/* Bearframe Engine Kit: deterministic audio control messages.
 * A platform adapter loads and plays clips; this module never accesses audio APIs.
 */
function createBearframeAudioDirector(catalog){
  if(!catalog||typeof catalog!=='object'||Array.isArray(catalog))
    throw new TypeError('Audio catalog required');
  var own=Object.prototype.hasOwnProperty;
  function has(v,k){return !!v&&own.call(v,k);}
  var ident=/^[a-z][a-z0-9_-]{0,63}$/;
  Object.keys(catalog).forEach(function(id){
    var c=catalog[id];
    if(!ident.test(id)||!c||['music','sfx'].indexOf(c.type)===-1)
      throw new TypeError('Invalid audio clip '+id);
    if(typeof c.path!=='string'||!/^audio\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(?:ogg|wav|mp3)$/.test(c.path))
      throw new TypeError('Invalid local audio path '+id);
    if(c.loop!==undefined&&typeof c.loop!=='boolean')
      throw new TypeError('Invalid loop flag '+id);
    if(c.type==='sfx'&&c.loop===true)
      throw new TypeError('Sound effects cannot loop '+id);
  });
  function fresh(){return {version:1,sequence:0,paused:false,muted:false,
    volumes:{master:100,music:80,sfx:100},music:null,musicStarted:false};}
  function gain(s,bus){return s.muted?0:Math.floor(s.volumes.master*s.volumes[bus]/100);}
  function valid(s){
    return !!s&&s.version===1&&Number.isInteger(s.sequence)&&s.sequence>=0&&
      typeof s.paused==='boolean'&&typeof s.muted==='boolean'&&
      !!s.volumes&&['master','music','sfx'].every(function(k){return Number.isInteger(s.volumes[k])&&s.volumes[k]>=0&&s.volumes[k]<=100;})&&
      (s.music===null||(has(catalog,s.music)&&catalog[s.music].type==='music'))&&
      typeof s.musicStarted==='boolean'&&
      !(s.music===null&&s.musicStarted);
  }
  function apply(previous,action){
    if(!valid(previous))throw new TypeError('Invalid audio state');
    if(!action||typeof action.type!=='string')return {state:previous,commands:[]};
    var next=JSON.parse(JSON.stringify(previous)),cmd=[],changed=false,id=action.id;
    function stop(){if(next.music!==null&&next.musicStarted)cmd.push({type:'stop',bus:'music',id:next.music});}
    switch(action.type){
      case 'music':
        if(!has(catalog,id)||catalog[id].type!=='music'||next.music===id)break;
        stop();
        next.music=id;next.musicStarted=!next.paused;
        if(next.musicStarted)cmd.push({type:'play',bus:'music',id:id,path:catalog[id].path,
          loop:catalog[id].loop!==false,gain:gain(next,'music')});
        changed=true;break;
      case 'sfx':
        if(has(catalog,id)&&catalog[id].type==='sfx'&&!next.paused&&!next.muted&&gain(next,'sfx')>0)
          cmd.push({type:'play',bus:'sfx',id:id,path:catalog[id].path,loop:false,gain:gain(next,'sfx')});
        break;
      case 'stopMusic':
        if(next.music!==null){stop();next.music=null;next.musicStarted=false;changed=true;}
        break;
      case 'pause':
        if(!next.paused){
          if(next.musicStarted)cmd.push({type:'pause',bus:'music',id:next.music});
          next.paused=true;changed=true;
        }break;
      case 'resume':
        if(next.paused){
          next.paused=false;changed=true;
          if(next.music!==null){
            if(next.musicStarted)cmd.push({type:'resume',bus:'music',id:next.music});
            else {
              next.musicStarted=true;
              cmd.push({type:'play',bus:'music',id:next.music,path:catalog[next.music].path,
                loop:catalog[next.music].loop!==false,gain:gain(next,'music')});
            }
          }
        }break;
      case 'volume':
        if(['master','music','sfx'].indexOf(action.bus)<0||
          !Number.isInteger(action.value)||action.value<0||action.value>100)break;
        if(next.volumes[action.bus]!==action.value){
          next.volumes[action.bus]=action.value;changed=true;
          cmd.push({type:'gain',bus:'music',gain:gain(next,'music')});
          cmd.push({type:'gain',bus:'sfx',gain:gain(next,'sfx')});
        }break;
      case 'mute':
        if(!next.muted){
          next.muted=true;changed=true;
          cmd.push({type:'gain',bus:'music',gain:0},{type:'gain',bus:'sfx',gain:0});
        }break;
      case 'unmute':
        if(next.muted){
          next.muted=false;changed=true;
          cmd.push({type:'gain',bus:'music',gain:gain(next,'music')},
            {type:'gain',bus:'sfx',gain:gain(next,'sfx')});
        }break;
    }
    if(changed)next.sequence++;
    if(!changed)return {state:previous,commands:cmd};
    if(!valid(next))throw new Error('Audio transition violated state contract');
    return {state:next,commands:cmd};
  }
  return Object.freeze({fresh:fresh,apply:apply,validateState:valid});
}
if(typeof module!=='undefined'&&module.exports)module.exports=createBearframeAudioDirector;
