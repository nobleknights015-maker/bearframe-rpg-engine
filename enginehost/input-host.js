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
  function actions(screen){
    var root=roots[screen];
    return Array.from(root.querySelectorAll('button,select')).filter(isAvailable);
  }
  function focusStep(screen,delta){
    var list=actions(screen);
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
  function click(node){
    if(!isAvailable(node)||typeof node.click!=='function')return false;
    node.click();return true;
  }
  function byQuery(screen,selector){
    return roots[screen].querySelector(selector);
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
      if(blocked)return focusStep('world',
        direction==='up'||direction==='left'?-1:1);
      return navigate(direction).ok===true;
    }
    if(event.type==='confirm'){
      if(mode==='save')return click(byQuery('save','#party-world-verify'));
      if(mode==='world'&&v.prompt){
        var focused=rootActive();
        return click(focused&&focused.hasAttribute&&
          focused.hasAttribute('data-event-choice')?focused:
          byQuery('world','[data-event-choice]'));
      }
      if(mode==='world'&&v.partyBattle)
        return click(byQuery('world','#party-commit'));
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
