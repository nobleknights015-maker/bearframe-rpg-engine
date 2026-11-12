/* Presentation-only, accessible small-screen navigator.
 * Never reads/writes project state, never dispatches gameplay commands.
 * Active tab is intentionally ephemeral and does not enter the save journal.
 */
function createBearframeScreenNavigator(navRoot,panels,onSelect){
  if(!navRoot||!panels)throw new TypeError('Screen tabs and panels required');
  if(onSelect!==undefined&&typeof onSelect!=='function')
    throw new TypeError('Screen selection callback must be a function');
  var names=['world','party','save'],tabs={},selected='world',mode=null;
  names.forEach(function(id){
    var tab=navRoot.querySelector('[data-party-world-tab="'+id+'"]');
    var panel=panels[id];
    if(!tab||!panel||!panel.id||tab.getAttribute('aria-controls')!==panel.id)
      throw new TypeError('Missing or mismatched engine screen '+id);
    tabs[id]=tab;
  });
  function select(id,focus){
    if(names.indexOf(id)<0)throw new RangeError('Unknown engine screen '+id);
    selected=id;
    names.forEach(function(key){
      var yes=key===id;
      panels[key].hidden=!yes;
      tabs[key].setAttribute('aria-selected',yes?'true':'false');
      tabs[key].tabIndex=yes?0:-1;
    });
    if(focus)tabs[id].focus();
    if(onSelect)onSelect(id);
    return id;
  }
  names.forEach(function(id,index){
    tabs[id].addEventListener('click',function(){select(id,false);});
    tabs[id].addEventListener('keydown',function(event){
      var next=null;
      if(event.key==='ArrowRight')next=names[(index+1)%names.length];
      else if(event.key==='ArrowLeft')next=names[(index+names.length-1)%names.length];
      else if(event.key==='Home')next=names[0];
      else if(event.key==='End')next=names[names.length-1];
      if(next!==null){
        event.preventDefault();
        select(next,true);
      }
    });
  });
  function sync(nextMode,interactive){
    if(['explore','event','battle'].indexOf(nextMode)<0)
      throw new RangeError('Unknown world phase');
    if(!interactive)return selected;
    if(nextMode===mode)return selected;
    var oldMode=mode;
    mode=nextMode;
    if(nextMode==='explore'&&oldMode===null)return selected;
    select('world',false);
    var selector=nextMode==='event'?'#party-world-events [data-event-choice]':
      nextMode==='battle'?'#party-world-battle [data-party-skill]':
      oldMode==='event'||oldMode==='battle'?'[data-party-world-dir="down"]':null;
    var target=selector&&panels.world.querySelector(selector);
    if(target&&target.disabled){
      target=panels.world.querySelector('[data-party-world-dir]:not([disabled])');
    }
    if(target&&!target.disabled){
      target.focus();
      if(typeof target.scrollIntoView==='function')
        target.scrollIntoView({block:'nearest'});
    }
    return selected;
  }
  select('world',false);
  return Object.freeze({select:select,sync:sync,current:function(){return selected;}});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeScreenNavigator;
