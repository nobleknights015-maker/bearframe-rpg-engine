/* Bearframe JRPG presentation menu. UI only: never writes gameplay state,
 * never simulates a second inventory/party, and never claims to save unless
 * the canonical persistent journal independently verifies the checkpoint.
 */
function createBearframeJRPGMenu(root, openButton, deps) {
  if (!root || !openButton || !root.ownerDocument || !deps ||
      typeof deps.view !== 'function' || typeof deps.dispatch !== 'function' ||
      typeof deps.verifySave !== 'function' || !deps.project ||
      typeof deps.onVisibility !== 'function')
    throw new TypeError('JRPG menu requires a DOM, canonical view, project, save and dispatch');
  var doc = root.ownerDocument;
  var own = Object.prototype.hasOwnProperty;
  var sections = [
    ['items','Items'],['techniques','Techniques'],['equipment','Equipment'],
    ['status','Status'],['party','Party'],['quests','Quests'],
    ['save','Save'],['options','Options']
  ];
  var current='overview', opened=false, selected=0, actionIndex=0, pageNumber=0,
      showPad=true, reducedMotion=false;
  var commands=root.querySelector('[data-jrpg-commands]');
  var detail=root.querySelector('[data-jrpg-details]');
  var closeButton=root.querySelector('[data-jrpg-close]');
  var heading=root.querySelector('[data-jrpg-heading]');
  if(!commands||!detail||!closeButton||!heading)
    throw new TypeError('Incomplete JRPG menu regions');
  var commandButtons=[],subActions=[];
  function node(tag,label,className){
    var el=doc.createElement(tag);
    if(label!==undefined)el.textContent=String(label);
    if(className)el.className=className;
    return el;
  }
  function empty(container){while(container.firstChild)container.removeChild(container.firstChild);}
  function line(text,className){detail.appendChild(node('p',text,className||'jrpg-line'));}
  function labelFor(id){return sections.filter(function(entry){return entry[0]===id;})[0][1];}
  function item(id){return own.call(deps.project.items,id)?deps.project.items[id]:null;}
  function actors(v){return Array.isArray(v.partyActors)?v.partyActors:[];}
  function isBlocked(v){return !v||!!v.prompt||!!v.partyBattle||!!v.battle;}
  function addAction(label,callback,disabled,description){
    var btn=node('button',label,'jrpg-action');
    btn.type='button';btn.disabled=!!disabled;
    btn.setAttribute('data-jrpg-action','');
    if(description)btn.setAttribute('aria-label',description);
    btn.addEventListener('click',function(){
      if(!btn.disabled)callback();
    });
    detail.appendChild(btn);
    subActions.push(btn);
    return btn;
  }
  function message(text){
    var status=root.querySelector('[data-jrpg-message]');
    if(status)status.textContent=text;
  }
  function commit(command){
    var result=deps.dispatch(command);
    if(result&&result.ok){
      var section=current;
      render();
      current=section;
      message('Action saved.');
    }else message('Action not saved: '+(result&&result.reason||'unavailable'));
    return result;
  }
  function summary(v){
    var box=node('div',undefined,'jrpg-summary');
    box.appendChild(node('p',(v.mapName||v.map||'Unknown area'),'jrpg-location-name'));
    actors(v).forEach(function(actor){
      var row=node('div',undefined,'jrpg-actor');
      row.appendChild(node('strong',actor.name,'jrpg-actor-name'));
      row.appendChild(node('span','HP '+actor.hp+'/'+actor.maxHp+' · MP '+actor.mp+'/'+actor.maxMp));
      var prog=v.partyProgression&&v.partyProgression[actor.id];
      if(prog)row.appendChild(node('span','Lv '+prog.level+' · XP '+prog.xp));
      box.appendChild(row);
    });
    if(!actors(v).length)box.appendChild(node('p','HP '+v.hp+'/'+v.maxHp));
    return box;
  }
  function showOverview(v){
    line('Choose a command.','jrpg-helper');
    detail.appendChild(summary(v));
    var keys=Object.keys(v.quests||{});
    if(keys.length){
      var id=keys[0],quest=deps.project.quests[id];
      if(quest&&quest.stages)line('Objective · '+(quest.stages[v.quests[id]]||'Continue exploring'));
    }
  }
  function items(v){
    var ids=Object.keys(v.inventory||{}).filter(function(id){return v.inventory[id]>0;}).sort();
    if(!ids.length){line('Your inventory is empty.');return;}
    ids.forEach(function(id){
      var spec=item(id);if(!spec)return;
      line(spec.name+' ×'+v.inventory[id],'jrpg-entry');
      if(spec.kind!=='consumable')return;
      var group=actors(v);
      if(group.length){
        group.forEach(function(actor){
          addAction('Use on '+actor.name,function(){commit({type:'use',item:id,target:actor.id});},
            isBlocked(v)||actor.hp>=actor.maxHp);
        });
      }else addAction('Use '+spec.name,function(){commit({type:'use',item:id});},
        isBlocked(v)||v.hp>=v.maxHp);
    });
  }
  function equipment(v){
    var roster=actors(v);
    if(!roster.length)roster=[{id:null,name:'Player'}];
    var slots=['weapon','armor','accessory'];
    roster.forEach(function(actor){
      var worn=actor.id!==null&&v.partyGear?v.partyGear[actor.id]:v.equipment;
      if(!worn)return;
      detail.appendChild(node('h4',actor.name,'jrpg-section-label'));
      slots.forEach(function(slot){
        var equipped=worn[slot],spec=equipped&&item(equipped);
        line(slot.toUpperCase()+' · '+(spec?spec.name:'—'));
        if(equipped)addAction('Unequip '+slot,function(){
          commit({type:'unequip',slot:slot,...(actor.id!==null?{actor:actor.id}:{})});
        },isBlocked(v));
        Object.keys(v.inventory||{}).sort().forEach(function(id){
          var target=item(id);
          if(!target||target.kind!==slot||equipped===id)return;
          var allocated=0;
          if(v.partyGear)Object.keys(v.partyGear).forEach(function(actorId){
            if(v.partyGear[actorId][slot]===id)allocated++;
          });
          addAction('Equip '+target.name,function(){
            commit({type:'equip',item:id,...(actor.id!==null?{actor:actor.id}:{})});
          },isBlocked(v)||allocated>=v.inventory[id]);
        });
      });
    });
  }
  function techniques(v){
    var roster=actors(v);
    if(!roster.length){line('Techniques become available through the party system.');return;}
    roster.forEach(function(actor){
      detail.appendChild(node('h4',actor.name+' · MP '+actor.mp+'/'+actor.maxMp,'jrpg-section-label'));
      (actor.skills||[]).forEach(function(id){
        var skill=deps.project.partyCombat&&deps.project.partyCombat.skills[id];
        line((skill&&skill.name||id)+' · '+(skill?skill.cost+' MP':'Technique'),'jrpg-entry');
      });
    });
    line('Choose techniques during battle. Field casting is not available in this engine build.','jrpg-helper');
  }
  function status(v){
    actors(v).forEach(function(actor){
      detail.appendChild(node('h4',actor.name,'jrpg-section-label'));
      line('HP '+actor.hp+'/'+actor.maxHp+' · MP '+actor.mp+'/'+actor.maxMp);
      line('ATK '+actor.attack+' · DEF '+actor.defense+' · SPD '+actor.speed);
      var p=v.partyProgression&&v.partyProgression[actor.id];
      if(p)line('Level '+p.level+' · XP '+p.xp+(p.nextLevelXp===null?' (MAX)':' / '+p.nextLevelXp));
      (actor.statuses||[]).forEach(function(s){line('Effect: '+s.type+' ('+s.turns+' turns)');});
    });
    if(!actors(v).length)line('HP '+v.hp+'/'+v.maxHp);
  }
  function quests(v){
    var q=v.quests||{},ids=Object.keys(q).sort();
    if(!ids.length){line('No active objectives.');return;}
    ids.forEach(function(id){
      var info=deps.project.quests[id];
      if(info&&info.stages)line(info.stages[q[id]]||'Objective complete','jrpg-entry');
    });
  }
  function saves(v){
    var check=deps.verifySave();
    var revision=check&&check.revision;
    line('Auto-save · Slot 1','jrpg-entry');
    line(check&&check.ok?'Saved checkpoint verified · Revision '+revision:
      'Checkpoint verification unavailable');
    line('Progress is committed automatically after successful actions.','jrpg-helper');
    addAction('Verify checkpoint',function(){
      var result=deps.verifySave();
      message(result&&result.ok?'Verified saved checkpoint · Revision '+result.revision:
        'Save verification failed. Your existing checkpoint was not modified.');
    },false);
  }
  function options(){
    line('Display & controls','jrpg-entry');
    addAction(showPad?'Hide touch D-pad':'Show touch D-pad',function(){
      showPad=!showPad;root.ownerDocument.body.classList.toggle('jrpg-pad-hidden',!showPad);
      render();
    },false);
    addAction(reducedMotion?'Enable transition animations':'Reduce transition animations',function(){
      reducedMotion=!reducedMotion;
      root.ownerDocument.body.classList.toggle('jrpg-reduced-motion',reducedMotion);
      render();
    },false);
    line('These display preferences do not change the game save.','jrpg-helper');
  }
  function render(){
    if(!opened)return;
    var v=deps.view();if(!v)return;
    empty(detail);subActions=[];
    heading.textContent=current==='overview'?'Command Menu':labelFor(current);
    if(current==='overview')showOverview(v);
    else if(current==='items')items(v);
    else if(current==='equipment')equipment(v);
    else if(current==='techniques')techniques(v);
    else if(current==='status'||current==='party')status(v);
    else if(current==='quests')quests(v);
    else if(current==='save')saves(v);
    else if(current==='options')options();
    commandButtons.forEach(function(b,i){
      var active=sections[i][0]===current;
      b.setAttribute('aria-current',active?'page':'false');
      b.setAttribute('data-jrpg-selected',i===selected?'true':'false');
    });
    // Page long inventories, rosters and equipment actions rather than
    // scrolling or clipping out-of-reach buttons on an Android landscape HUD.
    var entries=Array.from(detail.children),pageSize=7;
    var totalPages=Math.ceil(entries.length/pageSize);
    var allActions=subActions.slice();
    pageNumber=Math.min(pageNumber,Math.max(0,totalPages-1));
    if(totalPages>1){
      var pager=node('div',undefined,'jrpg-pages');
      var previous=node('button','◀ Previous');
      var next=node('button','Next ▶');
      previous.type=next.type='button';
      previous.setAttribute('data-jrpg-page','previous');
      next.setAttribute('data-jrpg-page','next');
      function updatePage(offset){
        pageNumber=Math.max(0,Math.min(totalPages-1,pageNumber+offset));
        entries.forEach(function(entry,i){entry.hidden=Math.floor(i/pageSize)!==pageNumber;});
        previous.disabled=pageNumber===0;next.disabled=pageNumber===totalPages-1;
        subActions=allActions.filter(function(a){return !a.hidden;});
        subActions.push(previous,next);
        actionIndex=0;
      }
      previous.addEventListener('click',function(){updatePage(-1);});
      next.addEventListener('click',function(){updatePage(1);});
      pager.appendChild(previous);pager.appendChild(next);detail.appendChild(pager);
      updatePage(0);
    }
    if(actionIndex>=subActions.length)actionIndex=0;
  }
  sections.forEach(function(entry,i){
    var btn=node('button',entry[1],'jrpg-command');
    btn.type='button';btn.setAttribute('data-jrpg-command',entry[0]);
    btn.addEventListener('click',function(){
      selected=i;actionIndex=0;pageNumber=0;current=entry[0];render();
    });
    commands.appendChild(btn);commandButtons.push(btn);
  });
  function open(section){
    var v=deps.view();
    if(isBlocked(v))return false;
    opened=true;root.hidden=false;root.setAttribute('aria-hidden','false');
    if(section&&sections.some(function(s){return s[0]===section;})){
      current=section;
      selected=sections.findIndex(function(s){return s[0]===section;});
    }else current='overview';
    actionIndex=0;pageNumber=0;render();
    commandButtons[selected].focus();
    deps.onVisibility(true);
    return true;
  }
  function close(){
    if(!opened)return false;
    opened=false;root.hidden=true;root.setAttribute('aria-hidden','true');
    current='overview';message('');openButton.focus();deps.onVisibility(false);
    return true;
  }
  function back(){
    if(!opened)return false;
    if(current!=='overview'){
      current='overview';actionIndex=0;pageNumber=0;render();commandButtons[selected].focus();return true;
    }
    return close();
  }
  function handle(event){
    if(!event||typeof event!=='object')return false;
    if(!opened){
      if(event.type==='menu')return open();
      if(event.type==='pause')return open('save');
      return false;
    }
    if(event.type==='cancel')return back();
    if(event.type==='menu'||event.type==='map')return close();
    if(event.type==='pause'){current='save';selected=6;render();return true;}
    if(event.type==='navigate'){
      if(!['up','down','left','right'].includes(event.direction))return false;
      if(current!=='overview'&&event.direction==='left')return back();
      if(current!=='overview'&&event.direction==='right'&&subActions.length){
        subActions[actionIndex].focus();return true;
      }
      var shift=event.direction==='up'||event.direction==='left'?-1:1;
      if(current!=='overview'&&subActions.length&&
         subActions.indexOf(doc.activeElement)>=0){
        actionIndex=(actionIndex+shift+subActions.length)%subActions.length;
        subActions[actionIndex].focus();return true;
      }
      selected=(selected+shift+sections.length)%sections.length;
      commandButtons[selected].focus();render();return true;
    }
    if(event.type==='confirm'){
      if(doc.activeElement&&subActions.indexOf(doc.activeElement)>=0){
        if(doc.activeElement.disabled)return false;
        doc.activeElement.click();return true;
      }
      current=sections[selected][0];actionIndex=0;pageNumber=0;render();
      if(subActions.length)subActions[0].focus();
      return true;
    }
    if(event.type==='next-tab'||event.type==='previous-tab'){
      selected=(selected+(event.type==='next-tab'?1:sections.length-1))%sections.length;
      commandButtons[selected].focus();render();return true;
    }
    return false;
  }
  openButton.addEventListener('click',function(){opened?close():open();});
  closeButton.addEventListener('click',back);
  root.hidden=true;root.setAttribute('aria-hidden','true');
  return Object.freeze({open:open,close:close,back:back,handle:handle,
    refresh:render,isOpen:function(){return opened;},current:function(){return current;}});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeJRPGMenu;
