/* General-purpose, game-neutral event/gear/quest controls.
 * Reads cloned canonical engine view and submits only standard commands to
 * the host's save-before-render session. No direct state or storage writes.
 */
function createBearframeRuntimePanels(eventRoot,gearRoot,status,project,view,dispatch){
  if(!eventRoot||!gearRoot||!status||!project||
     typeof view!=='function'||typeof dispatch!=='function')
    throw new TypeError('Event/inventory panel requires a canonical runtime view');
  var doc=eventRoot.ownerDocument;
  function el(tag,text){
    var node=doc.createElement(tag);
    if(text!==undefined)node.textContent=String(text);
    return node;
  }
  function clear(node){
    while(node.firstChild)node.removeChild(node.firstChild);
  }
  function action(root,title,attribute,value,command,disabled){
    var button=el('button',title);
    button.type='button';
    button.setAttribute(attribute,value);
    button.setAttribute('aria-label',title);
    button.disabled=!!disabled;
    button.addEventListener('click',function(){
      var outcome=dispatch(command);
      status.textContent=outcome.ok?'Action committed to the engine save.':
        'Action refused: '+outcome.reason;
    });
    root.appendChild(button);
    return button;
  }
  function render(){
    clear(eventRoot);clear(gearRoot);
    var v=view();
    if(!v){gearRoot.appendChild(el('p','Game session not started'));return;}
    if(v.prompt){
      var ev=project.events[v.prompt.event];
      if(!ev)throw new Error('Unknown event in canonical runtime view');
      eventRoot.appendChild(el('p',ev.text));
      ev.choices.forEach(function(choice){
        action(eventRoot,choice.text,'data-event-choice',choice.id,
          {type:'choose',id:choice.id},false);
      });
      action(eventRoot,'Close conversation','data-event-close','true',
        {type:'close'},false);
    }else eventRoot.appendChild(el('p','No event is awaiting a choice.'));
    var locked=!!v.prompt||!!v.battle||!!v.partyBattle;
    var items=Object.keys(v.inventory).sort();
    if(items.length===0)gearRoot.appendChild(el('p','Inventory empty.'));
    items.forEach(function(id){
      var item=project.items[id];
      if(!item)throw new Error('Unknown inventory item '+id);
      var line=el('div');
      line.className='inventory-line';
      line.appendChild(el('span',item.name+' ×'+v.inventory[id]));
      if(item.kind==='weapon'){
        action(line,v.weapon===id?'Equipped: '+item.name:'Equip '+item.name,
          'data-inventory-equip',id,{type:'equip',item:id},
          locked||v.weapon===id);
      }else if(item.kind==='consumable'){
        if(v.partyActors&&v.partyActors.length>1){
          v.partyActors.forEach(function(actor){
            action(line,'Use '+item.name+' on '+actor.name,
              'data-inventory-use',id,
              {type:'use',item:id,target:actor.id},
              locked||actor.hp>=actor.maxHp);
          });
        }else{
          action(line,'Use '+item.name,'data-inventory-use',id,
            {type:'use',item:id},locked||v.hp>=v.maxHp);
        }
      }
      gearRoot.appendChild(line);
    });
    if(v.weapon!==null)
      action(gearRoot,'Unequip weapon','data-inventory-unequip','true',
        {type:'unequip'},locked);
    var questIds=Object.keys(v.quests).sort();
    questIds.forEach(function(id){
      var q=project.quests[id];
      if(!q||!q.stages[v.quests[id]])
        throw new Error('Unknown quest stage in runtime view');
      gearRoot.appendChild(el('p','Objective: '+q.stages[v.quests[id]]));
    });
  }
  return Object.freeze({render:render});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeRuntimePanels;
