// Android presentation adapter. The simulator and pixel-art renderer are shared with the browser.
function Image(){this.complete=true;this.naturalWidth=592;}
var nativeGame=buildEngine({WORLD:WORLD,FOES:FOES,TEXT:TEXT,ACTIONS:ACTIONS});
var nativeState=null;
function nativeDispatch(raw){
    var cmd=JSON.parse(raw);
    if(cmd.type==='load')nativeState=nativeGame.restore(cmd.value);
    else if(cmd.type==='new')nativeState=nativeGame.fresh(cmd.name,cmd.finish);
    else nativeState=nativeGame.step(nativeState,cmd);
    if(!nativeState)return '{}';
    var s=nativeState,b=s.battle,commands=[],points=[];
    var ctx={
      fillRect:function(x,y,w,h){commands.push(['rect',x,y,w,h,this.fillStyle]);},
      beginPath:function(){points=[];},
      moveTo:function(x,y){points.push(x,y);},
      lineTo:function(x,y){points.push(x,y);},
      closePath:function(){},
      fill:function(){commands.push(['poly',points,this.fillStyle]);},
      save:function(){commands.push(['save']);},restore:function(){commands.push(['restore']);},
      translate:function(x,y){commands.push(['translate',x,y]);},scale:function(x,y){commands.push(['scale',x,y]);},
      drawImage:function(img,x,y,w,h){commands.push(['image',img.src,x,y,w,h]);}
    };
    paint({width:296,height:202,getContext:function(){return ctx;}},s);
    var options=[];
    if(b)options=[['combat','strike','Strike'],['combat','pulse','Pulse · 1 charge',!s.charge],['combat','guard','Brace + charge'],['combat','withdraw','Withdraw']];
    else if(s.prompt){
        options=ACTIONS[s.prompt].map(function(row){return ['choose',row[0],row[1]];});
        options.push(['close','','Step back']);
    }else if(WORLD[s.area].rows[s.y][s.x]==='P')options.push(['rest','','Rest at berth']);
    var objective=b?'Target '+b.hp+'/'+FOES[b.key].hp+' · '+(b.turn%FOES[b.key].period===0?'High output incoming':'Standard cycle'):
       (s.flags.met?'Expedition complete':s.area==='pod'?'Find the gallery exit →':s.area==='gallery'?'Cross the gallery to the ridge →':'Find the expedition surveyor')+
       (s.flags.echoAlly?' · Echo ally':'')+(s.flags.gridAlly?' · Crawler escort':'');
    return JSON.stringify({save:JSON.stringify(s),draw:commands,title:b?FOES[b.key].name:WORLD[s.area].name,
      mode:b?'Turn '+b.turn:s.flags.met?'Survey complete':'On foot',message:s.message,objective:objective,
      stats:s.name+' · Chassis '+s.hp+'/'+nativeGame.hpMax(s)+' · Charge '+s.charge+'/3'+(s.weapon?' · '+(s.weapon==='blade'?'Arc blade':'Coil lance'):''),
      pad:!b&&!s.prompt,options:options});
}
