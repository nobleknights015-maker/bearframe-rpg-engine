/* Minimal engine-only combat controls for the SAME canonical world session.
 * Unlike the independent party diagnostic, these commands resolve the
 * encounter that blocks main-world movement, and save through session.dispatch.
 */
function createBearframeRuntimeCombatPanel(root,project,view,dispatch){
  if(!root||!project||typeof view!=='function'||typeof dispatch!=='function')
    throw new TypeError('Main-world combat panel requires root and canonical session');
  var doc=root.ownerDocument;
  function render(){
    while(root.firstChild)root.removeChild(root.firstChild);
    var v=view();if(!v||!v.battle)return;
    var foe=project.foes[v.battle.foe];
    if(!foe)throw new TypeError('Unknown current encounter');
    var title=doc.createElement('p');
    title.textContent='Encounter: '+foe.name+' · Enemy HP '+v.battle.hp+'/'+foe.hp+
      ' · Your HP '+v.hp+'/'+v.maxHp+' · Charge '+v.charge+'/'+v.maxCharge;
    root.appendChild(title);
    [
      ['strike','Strike',false],['pulse','Pulse',v.charge<((project.rules&&project.rules.pulseCost)||1)],
      ['guard','Guard',false],['flee','Flee',false]
    ].forEach(function(option){
      var button=doc.createElement('button');
      button.type='button';button.setAttribute('data-runtime-combat',option[0]);
      button.setAttribute('aria-label','Encounter '+option[1]);
      button.textContent=option[1];button.disabled=option[2];
      button.addEventListener('click',function(){
        dispatch({type:'combat',id:option[0]});
      });
      root.appendChild(button);
    });
  }
  return Object.freeze({render:render});
}
if(typeof module!=='undefined'&&module.exports)
 module.exports=createBearframeRuntimeCombatPanel;
