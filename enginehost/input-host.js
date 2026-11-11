/* Controller-neutral v2 WebView action adapter.
 * Native Android, browser keyboard or Gamepad pollers submit semantic input
 * here; it NEVER bypasses the visible DOM, canonical dispatch or save gate.
 */
function createBearframeWorldInput(screens,view,navigate,roots){
  if(!screens||typeof screens.current!=='function'||
     typeof screens.select!=='function'||typeof view!=='function'||
     typeof navigate!=='function'||!roots||
     !roots.world||!roots.party||!roots.save)
    throw new TypeError('Engine input requires screens and canonical world controls');
  var tabs=['world','party','save'];
  function isAvailable(node){
    return !!node&&!node.disabled&&
      (typeof node.getClientRects!=='function'||node.getClientRects().length>0);
  }
  function actions(screen,world){
    var root=roots[screen];
    // While world movement is locked, navigation stays inside the visible
    // dialogue or party battle controls. Disabled directional buttons and
    // unrelated actions may never intercept gamepad focus.
    if(screen==='world'&&world){
      var selector=world.prompt?'#party-world-events':
        world.partyBattle?'#party-world-battle':null;
      if(selector)root=root.querySelector(selector)||root;
    }
    return Array.from(root.querySelectorAll('button,select')).filter(isAvailable);
  }
  function focusStep(screen,delta,world){
    var list=actions(screen,world);
    if(!list.length)return false;
    var focused=list.indexOf(rootActive());
    var next=focused<0?(delta<0?list.length-1:0):
      (focused+delta+list.length)%list.length;
    list[next].focus();
    if(typeof list[next].scrollIntoView==='function')
      list[next].scrollIntoView({block:'nearest'});
    return true;
  }
  function rootActive(){
    return roots.world.ownerDocument.activeElement;
  }
  function battleControl(node){
    return !!node&&(
      node.id==='party-commit'||
      typeof node.hasAttribute==='function'&&
      (node.hasAttribute('data-party-skill')||
       node.hasAttribute('data-party-target')));
  }
  function changeBattleOption(select,delta){
    if(!select||!battleControl(select)||select.disabled||
       select.tagName!=='SELECT'||!select.options||select.options.length<2)
      return false;
    var index=select.selectedIndex;
    if(!Number.isInteger(index)||index<0)return false;
    var next=Math.max(0,Math.min(select.options.length-1,index+delta));
    if(next===index)return false;
    select.selectedIndex=next;
    // The party panel updates valid targets whenever its selected skill
    // changes. Dispatching the real change event preserves that rule.
    select.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  }
  function click(node){
    if(!isAvailable(node)||typeof node.click!=='function')return false;
    node.click();return true;
  }
  function byQuery(screen,selector){
    return roots[screen].querySelector(selector);
  }
  // Paged landscape menus place Next/Previous inside the visible action
  // region. Controller Confirm must activate those buttons, never mistake
  // them for a choice or prematurely submit the party's combat round.
  function confirmPage(screen,world,node){
    if(!node||typeof node.getAttribute!=='function')return false;
    var page=node.getAttribute('data-engine-page');
    var section=screen==='party'?'inventory':
      screen==='world'&&world.prompt?'events':
      screen==='world'&&world.partyBattle?'battle':null;
    if(!section||(page!==section+':-1'&&page!==section+':1'))
      return false;
    // Reject stale/detached controls and choices hidden by the no-scroll
    // pager. A page button must be in the current visible action list.
    if(actions(screen,world).indexOf(node)<0)return false;
    return click(node);
  }
  function turnTab(delta){
    var index=tabs.indexOf(screens.current());
    screens.select(tabs[(index+delta+tabs.length)%tabs.length],true);
    return true;
  }
  function handle(event){
    if(!event||typeof event!=='object')return false;
    var mode=screens.current(),v=view();
    if(!v)return false;
    var blocked=!!v.prompt||!!v.partyBattle||!!v.battle;
    if(event.type==='navigate'){
      var direction=event.direction;
      if(['up','down','left','right'].indexOf(direction)<0)return false;
      if(mode!=='world'){
        if(direction==='left')return turnTab(-1);
        if(direction==='right')return turnTab(1);
        return focusStep(mode,direction==='up'?-1:1);
      }
      if(blocked){
        var delta=direction==='up'||direction==='left'?-1:1;
        if(v.partyBattle&&(direction==='left'||direction==='right')){
          var focused=rootActive();
          if(changeBattleOption(focused,delta))return true;
        }
        return focusStep('world',delta,v);
      }
      return navigate(direction).ok===true;
    }
    if(event.type==='confirm'){
      if(mode==='save')return click(byQuery('save','#party-world-verify'));
      if(mode==='world'&&v.prompt){
        var focused=rootActive();
        if(focused&&focused.hasAttribute&&focused.hasAttribute('data-engine-page'))
          return confirmPage('world',v,focused);
        // The event close action is a legitimate focused action; selecting
        // it must never silently choose the first dialogue answer instead.
        if(focused&&focused.hasAttribute&&focused.hasAttribute('data-event-close'))
          return actions('world',v).indexOf(focused)>=0&&click(focused);
        return click(focused&&focused.hasAttribute&&
          focused.hasAttribute('data-event-choice')?focused:
          byQuery('world','[data-event-choice]'));
      }
      if(mode==='world'&&v.partyBattle){
        // A/Cross must not commit a default round before the player has
        // been able to select each actor's ability and target.
        var selected=rootActive();
        if(selected&&selected.hasAttribute&&selected.hasAttribute('data-engine-page'))
          return confirmPage('world',v,selected);
        if(selected&&selected.id==='party-commit')
          return click(selected);
        return focusStep('world',1,v);
      }
      if(mode==='party'){
        var active=rootActive();
        return roots.party.contains(active)?click(active):focusStep('party',1);
      }
      return false;
    }
    if(event.type==='cancel'){
      if(mode!=='world'){screens.select('world',true);return true;}
      if(v.prompt)return click(byQuery('world','[data-event-close]'));
      return false;
    }
    if(event.type==='menu'){screens.select('party',true);return true;}
    if(event.type==='map'){screens.select('world',true);return true;}
    if(event.type==='pause'){screens.select('save',true);return true;}
    if(event.type==='previous-tab')return turnTab(-1);
    if(event.type==='next-tab')return turnTab(1);
    return false;
  }
  return Object.freeze({handle:handle});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeWorldInput;
