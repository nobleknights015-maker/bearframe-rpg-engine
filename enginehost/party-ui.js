/* JRPG battle presentation over the canonical deterministic party encounter.
 * This module owns only DOM controls: no state machine, damage arithmetic,
 * turn order, random source, inventory or save writes.
 */
function createBearframePartyCommandPanel(root,probe,skillBook,notify){
  if(!root||!probe||typeof probe.battle!=='function'||
     typeof probe.submit!=='function'||!skillBook)
    throw new TypeError('Party panel requires root, session and skill catalog');
  var doc=root.ownerDocument;
  function make(tag,text,klass){
    var node=doc.createElement(tag);
    if(text!==undefined)node.textContent=String(text);
    if(klass)node.className=klass;
    return node;
  }
  function fillOptions(select,records){
    while(select.firstChild)select.removeChild(select.firstChild);
    records.forEach(function(row){
      var option=make('option',row.name);
      option.value=row.id;select.appendChild(option);
    });
    select.disabled=records.length===0;
  }
  function meter(value,max,kind){
    var track=make('div',undefined,'jrpg-battle-meter jrpg-battle-'+kind);
    track.setAttribute('role','progressbar');
    track.setAttribute('aria-valuemin','0');
    track.setAttribute('aria-valuemax',String(max));
    track.setAttribute('aria-valuenow',String(value));
    var fill=make('div',undefined,'jrpg-battle-meter-fill');
    var percent=max>0?Math.min(100,Math.max(0,Math.floor(value*100/max))):0;
    fill.setAttribute('style','width:'+percent+'%');
    track.appendChild(fill);return track;
  }
  function actorCard(actor,klass){
    var card=make('div',undefined,klass);
    card.setAttribute('data-battle-actor',actor.id);
    card.appendChild(make('strong',actor.name));
    card.appendChild(make('span','HP '+actor.hp+'/'+actor.maxHp,'jrpg-battle-stat'));
    card.appendChild(meter(actor.hp,actor.maxHp,'hp'));
    if(actor.maxMp>0){
      card.appendChild(make('span','MP '+actor.mp+'/'+actor.maxMp,'jrpg-battle-stat'));
      card.appendChild(meter(actor.mp,actor.maxMp,'mp'));
    }
    if(actor.statuses&&actor.statuses.length)
      card.appendChild(make('small',actor.statuses.map(function(s){
        return s.type;
      }).join(', '),'jrpg-battle-status'));
    return card;
  }
  function renderArena(battle){
    var arena=make('section',undefined,'jrpg-battle-stage');
    arena.setAttribute('aria-label','Battle scene and party status');
    var top=make('div',undefined,'jrpg-battle-scene');
    var heading=make('h3','BATTLE · ROUND '+(battle.turn||1));
    top.appendChild(heading);
    var foes=make('div',undefined,'jrpg-battle-foes');
    var alive=battle.foes.filter(function(a){return a.hp>0;});
    alive.slice(0,4).forEach(function(a){
      foes.appendChild(actorCard(a,'jrpg-battle-foe'));
    });
    if(alive.length>4)
      foes.appendChild(make('p','+'+(alive.length-4)+' additional targets',
        'jrpg-battle-more'));
    top.appendChild(foes);arena.appendChild(top);
    var roster=make('div',undefined,'jrpg-battle-party');
    roster.setAttribute('aria-label','Party condition');
    battle.party.forEach(function(a){
      roster.appendChild(actorCard(a,'jrpg-battle-member'));
    });
    arena.appendChild(roster);
    if(Array.isArray(battle.log)&&battle.log.length){
      var log=make('div',undefined,'jrpg-battle-log');
      log.setAttribute('role','status');
      log.setAttribute('aria-live','polite');
      log.textContent=battle.log.slice(-2).join(' · ');
      arena.appendChild(log);
    }
    return arena;
  }
  function render(){
    while(root.firstChild)root.removeChild(root.firstChild);
    var battle=probe.battle();
    if(!battle||battle.phase!=='active')return;
    root.appendChild(renderArena(battle));
    var rows=[];
    battle.party.filter(function(actor){return actor.hp>0;}).forEach(function(actor){
      var card=make('div',undefined,'party-command jrpg-battle-actions');
      card.setAttribute('aria-label','Actions for '+actor.name);
      card.appendChild(make('h4',actor.name+' · Choose action'));
      var skillLabel=make('label',actor.name+' ability');
      var skill=make('select');
      skill.setAttribute('aria-label',actor.name+' ability');
      skill.setAttribute('data-party-skill',actor.id);
      var available=actor.skills.filter(function(id){
        var meta=skillBook[id];return !!meta&&actor.mp>=meta.cost;
      }).map(function(id){
        var meta=skillBook[id];
        return {id:id,name:id+' · '+meta.cost+' MP'};
      });
      fillOptions(skill,available);
      skillLabel.appendChild(skill);card.appendChild(skillLabel);
      var targetLabel=make('label',actor.name+' target');
      var target=make('select');
      target.setAttribute('aria-label',actor.name+' target');
      target.setAttribute('data-party-target',actor.id);
      targetLabel.appendChild(target);card.appendChild(targetLabel);
      function updateTargets(){
        var chosen=skillBook[skill.value];
        var targets=chosen&&chosen.kind==='heal'?battle.party:
          chosen&&chosen.kind==='guard'?[actor]:battle.foes;
        fillOptions(target,targets.filter(function(a){return a.hp>0;})
          .map(function(a){return {id:a.id,name:a.name+' · HP '+a.hp};}));
        if(chosen&&chosen.kind==='guard')target.disabled=true;
      }
      skill.addEventListener('change',updateTargets);
      updateTargets();
      root.appendChild(card);
      rows.push({actor:actor.id,skill:skill,target:target});
    });
    if(!rows.length)return;
    var commit=make('button','Confirm party turn','jrpg-battle-confirm');
    commit.id='party-commit';commit.type='button';
    commit.setAttribute('aria-label','Confirm selected party turn');
    commit.disabled=rows.some(function(r){return !r.skill.value||!r.target.value;});
    commit.addEventListener('click',function(){
      var orders=rows.map(function(row){
        return {actor:row.actor,skill:row.skill.value,target:row.target.value};
      });
      var result=probe.submit(orders);
      // Parent host may synchronously rebuild panel and pager. Never draw a
      // duplicate UI pass after it has installed focus and page controls.
      var handled=typeof notify==='function'&&notify(result)===true;
      if(!handled)render();
    });
    root.appendChild(commit);
  }
  return Object.freeze({render:render});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframePartyCommandPanel;
