// Runs in the same Rhino interpreter version and compilation mode as Android.
function check(ok,message){if(!ok)throw new Error(message);}
function send(command){return JSON.parse(nativeDispatch(JSON.stringify(command)));}
var packet=send({type:'new',name:'Moth',finish:'Slate'});
function act(type,value){packet=send({type:type,value:value});}
function walk(path){
  var dir={R:'right',U:'up',L:'left',D:'down'};
  for(var i=0;i<path.length;i++)act('move',dir[path[i]]);
}
walk('UUU');act('choose','listen');walk('DDRRRR');act('choose','fit');walk('R');act('choose','blade');
walk('DRRRURRR');check(packet.title==='Relay gallery','gallery transition');
walk('RRRUUU');act('choose','invite');walk('DDRRRR');act('choose','fight');act('combat','pulse');
check(packet.mode==='Turn 2','battle round');
var saved=packet.save;nativeState=null;packet=send({type:'load',value:saved});check(packet.save===saved,'mobile restore');
act('combat','strike');walk('RRRRR');walk('RRUUU');act('choose','escort');walk('DDRRRRRR');
act('choose','private');
check(packet.mode==='Survey complete'&&packet.objective.indexOf('Crawler escort')>=0,'ending and allies');
check(packet.draw.some(function(cmd){return cmd[0]==='image'&&cmd[1]==='ridge.webp';}),'scenery binding');
print('PASS native adapter expedition, recruitment, save restore and drawing packet');
