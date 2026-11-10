/* Adapted from Chris's Plushbound Engine v1 ClassicWindowSystem.js.
 * https://github.com/nobleknights015-maker/Plushbound-Legends-mobile/blob/engine-v1-rebuild/engine/src/ui/ClassicWindowSystem.js
 * Bearframe variant: generic window skin ID and mobile-scaled defaults;
 * no Plushbound assets, DOM, structuredClone, or other host dependencies.
 */
function createBearframeWindowLayout(config){
  config=config||{};
  var defaults={padding:12,margin:4,lineHeight:24,fontSize:16,windowOpacity:0.92,
    contentsOpacity:1,cornerRadius:7,cursorBlinkMs:600,
    colors:{text:'#f4f1ea',disabled:'#8e9299',system:'#ffd37a',crisis:'#ff8e8e',gaugeBack:'#1e2430'}};
  var theme={};
  Object.keys(defaults).forEach(function(key){theme[key]=defaults[key];});
  if(config.theme){
    Object.keys(config.theme).forEach(function(key){theme[key]=config.theme[key];});
  }
  theme.colors=Object.assign({},defaults.colors,config.theme&&config.theme.colors||{});
  var vw=Math.max(128,Number(config.viewportWidth)||320);
  var vh=Math.max(128,Number(config.viewportHeight)||240);
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function fitRect(rect){
    rect=rect||{};var margin=Math.max(0,theme.margin);
    var width=Math.min(Math.max(1,Number(rect.width)||1),Math.max(1,vw-margin*2));
    var height=Math.min(Math.max(1,Number(rect.height)||1),Math.max(1,vh-margin*2));
    var x=clamp(Number(rect.x)||0,margin,Math.max(margin,vw-width-margin));
    var y=clamp(Number(rect.y)||0,margin,Math.max(margin,vh-height-margin));
    return {x:Math.round(x),y:Math.round(y),width:Math.round(width),height:Math.round(height)};
  }
  function windowModel(spec){
    spec=spec||{};
    var model={id:String(spec.id||'window'),rect:fitRect(spec.rect),frame:{
        cornerRadius:theme.cornerRadius,opacity:theme.windowOpacity,
        skin:'bearframe-classic',nineSlice:true
      },contentsOpacity:theme.contentsOpacity,padding:theme.padding,
      lineHeight:theme.lineHeight,fontSize:theme.fontSize,colors:clone(theme.colors)};
    Object.keys(spec).forEach(function(k){
      if(k!=='id'&&k!=='rect')model[k]=clone(spec[k]);
    });
    return model;
  }
  function setViewport(w,h){vw=Math.max(128,Number(w)||vw);vh=Math.max(128,Number(h)||vh);}
  function messageWindow(spec){
    spec=spec||{};
    var count=clamp(Math.floor(spec.lines===undefined?4:spec.lines),1,6);
    var h=theme.padding*2+theme.lineHeight*count;
    var rect={x:0,y:vh-h,width:vw,height:h};
    var face=spec.hasFace?{x:rect.x+theme.padding,y:rect.y+theme.padding,
      width:Math.min(spec.faceWidth||72,Math.max(1,h-theme.padding*2)),
      height:Math.min(spec.faceWidth||72,Math.max(1,h-theme.padding*2))}:null;
    var left=rect.x+theme.padding+(face?face.width+theme.padding:0);
    return windowModel({id:'message',rect:rect,
      contents:{x:left,y:rect.y+theme.padding,width:Math.max(1,rect.x+rect.width-theme.padding-left),
        height:Math.max(1,h-theme.padding*2)},
      face:face,name:spec.name||null});
  }
  function commandWindow(spec){
    spec=spec||{};
    var commands=Array.isArray(spec.commands)?spec.commands:[];
    var cols=clamp(Math.floor(spec.columns||1),1,4);
    var available=Math.max(1,Math.floor((vh-theme.margin*2-theme.padding*2)/theme.lineHeight));
    var rowLimit=clamp(Math.floor(spec.maxRows||8),1,available);
    var capacity=Math.max(1,rowLimit*cols);
    var ix=clamp(Math.floor(Number(spec.index)||0),0,Math.max(0,commands.length-1));
    var page=Math.floor(ix/capacity),count=Math.max(1,Math.ceil(commands.length/capacity));
    var start=page*capacity,visible=commands.slice(start,start+capacity);
    var rows=Math.max(1,Math.min(rowLimit,Math.ceil(visible.length/cols)||1));
    var height=theme.padding*2+rows*theme.lineHeight;
    var rect=fitRect({x:spec.x===undefined?8:spec.x,y:spec.y===undefined?8:spec.y,
      width:Math.max(80,spec.width||200),height:height});
    var items=visible.map(function(c,local){
      if(typeof c==='string')c={id:c,text:c};
      c=c||{};
      var i=start+local,row=Math.floor(local/cols),column=local%cols;
      var innerWidth=Math.max(1,rect.width-theme.padding*2);
      return {id:String(c.id===undefined?i:c.id),
        text:String(c.text===undefined?(c.label===undefined?c.id||'':c.label):c.text),
        enabled:c.enabled!==false,selected:i===ix,index:i,
        rect:{x:rect.x+theme.padding+column*innerWidth/cols,
          y:rect.y+theme.padding+row*theme.lineHeight,
          width:innerWidth/cols,height:theme.lineHeight}};
    });
    return windowModel({id:spec.id||'command',rect:rect,index:ix,items:items,columns:cols,
      pagination:{page:page,pageCount:count,pageStart:start,pageEnd:start+items.length,
        capacity:capacity,hasPrevious:page>0,hasNext:page+1<count}});
  }
  function choiceWindow(spec){
    spec=spec||{};
    var choices=spec.choices||[],rowCount=Math.max(1,Math.min(choices.length||1,6));
    var height=theme.padding*2+rowCount*theme.lineHeight;
    var anchorY=spec.messageRect?spec.messageRect.y:vh;
    var width=spec.width||200;
    return commandWindow({id:'choice',commands:choices,width:width,
      x:Math.max(0,vw-width-theme.margin),
      y:Math.max(0,anchorY-height-theme.margin),
      maxRows:6,index:spec.index||0});
  }
  function helpWindow(spec){
    spec=spec||{};
    var h=theme.padding*2+clamp(Math.floor(spec.heightLines||2),1,4)*theme.lineHeight;
    return windowModel({id:'help',rect:{x:0,y:0,width:vw,height:h},
      text:String(spec.text||'')});
  }
  return Object.freeze({theme:clone(theme),fitRect:fitRect,setViewport:setViewport,
    messageWindow:messageWindow,commandWindow:commandWindow,choiceWindow:choiceWindow,
    helpWindow:helpWindow,windowModel:windowModel});
}
if(typeof module!=='undefined'&&module.exports)module.exports=createBearframeWindowLayout;
