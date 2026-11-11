/* UI-only paging: keeps long event choices, inventory and battle actor
 * menus within the fitted 800x450 landscape screen without scrolling.
 * Hidden choices remain in the DOM with unchanged canonical commands.
 */
function createBearframeLandscapePager(roots){
  if(!roots||!roots.events||!roots.inventory||!roots.battle)
    throw new TypeError('Three landscape menu roots required');
  var specs={
    events:{root:roots.events,selector:'[data-event-choice]',size:4},
    inventory:{root:roots.inventory,selector:'.inventory-line,.party-roster-summary, p, :scope > button',size:2},
    battle:{root:roots.battle,selector:'.party-command',size:1}
  };
  var state={events:0,inventory:0,battle:0};
  function candidates(id){
    var cfg=specs[id],all=Array.from(cfg.root.children);
    if(id==='inventory')return all.filter(function(n){
      return n.classList.contains('inventory-line')||
        n.classList.contains('party-roster-summary')||
        n.tagName==='P'||n.tagName==='BUTTON';
    });
    if(id==='battle')return all.filter(function(n){return n.classList.contains('party-command');});
    return all.filter(function(n){return n.hasAttribute('data-event-choice');});
  }
  // A controller-activated Next/Previous button is removed when the pager
  // rerenders. Transfer focus into the newly visible page so the next A/Cross
  // press never lands on a stale button or selects an invisible old choice.
  function focusVisible(id){
    var items=candidates(id),target=null;
    for(var i=0;i<items.length;i++){
      var item=items[i];
      if(item.hasAttribute('data-engine-page-hidden'))continue;
      if((item.tagName==='BUTTON'||item.tagName==='SELECT')&&!item.disabled)
        target=item;
      else if(typeof item.querySelector==='function')
        target=item.querySelector('button:not([disabled]),select:not([disabled])');
      if(target&&typeof target.focus==='function')break;
      target=null;
    }
    if(!target){
      var nav=specs[id].root.querySelector('.engine-page-nav');
      if(nav)target=nav.querySelector('button:not([disabled])');
    }
    if(target&&typeof target.focus==='function'){target.focus();return true;}
    return false;
  }
  function refresh(id,reset){
    if(!Object.prototype.hasOwnProperty.call(specs,id))
      throw new TypeError('Unknown engine pager');
    var cfg=specs[id],old=cfg.root.querySelector('.engine-page-nav');
    if(old)cfg.root.removeChild(old);
    var items=candidates(id),count=Math.max(1,Math.ceil(items.length/cfg.size));
    if(reset)state[id]=0;
    state[id]=Math.max(0,Math.min(count-1,state[id]));
    items.forEach(function(item,index){
      var hidden=Math.floor(index/cfg.size)!==state[id];
      if(hidden)item.setAttribute('data-engine-page-hidden','');
      else item.removeAttribute('data-engine-page-hidden');
    });
    if(count<2)return {page:state[id]+1,pages:count,items:items.length};
    var nav=cfg.root.ownerDocument.createElement('div');
    nav.className='engine-page-nav';
    nav.setAttribute('role','group');
    nav.setAttribute('aria-label',id+' menu pages');
    function button(text,step){
      var el=cfg.root.ownerDocument.createElement('button');
      el.type='button';el.textContent=text;
      el.setAttribute('data-engine-page',id+':'+step);
      el.disabled=state[id]+step<0||state[id]+step>=count;
      el.addEventListener('click',function(){
        var focused=cfg.root.ownerDocument.activeElement===el;
        state[id]+=step;
        refresh(id,false);
        if(focused)focusVisible(id);
      });
      return el;
    }
    nav.appendChild(button('Previous',-1));
    var label=cfg.root.ownerDocument.createElement('span');
    label.textContent=(state[id]+1)+' / '+count;
    label.setAttribute('aria-live','polite');nav.appendChild(label);
    nav.appendChild(button('Next',1));cfg.root.appendChild(nav);
    return {page:state[id]+1,pages:count,items:items.length};
  }
  return Object.freeze({refresh:refresh,all:function(reset){
    return {events:refresh('events',reset),inventory:refresh('inventory',reset),
      battle:refresh('battle',reset)};
  },current:function(id){return state[id];}});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeLandscapePager;
