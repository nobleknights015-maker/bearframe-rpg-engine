/* Portable, DOM-only party action selection UI.
 * Consumes the canonical session's combat view and submits complete turn
 * orders. It owns neither simulation rules, game data nor storage.
 */
function createBearframePartyCommandPanel(root, probe, skillBook, notify) {
  if(!root||!probe||typeof probe.battle!=='function'||
     typeof probe.submit!=='function'||!skillBook)
    throw new TypeError('Party panel requires root, session and skill catalog');
  function create(tag){return root.ownerDocument.createElement(tag);}
  function fillOptions(select,records){
    while(select.firstChild)select.removeChild(select.firstChild);
    records.forEach(function(row){
      var option=create('option');option.value=row.id;
      option.textContent=row.name;select.appendChild(option);
    });
    select.disabled=records.length===0;
  }
  function render(){
    while(root.firstChild)root.removeChild(root.firstChild);
    var battle=probe.battle();
    if(!battle||battle.phase!=='active')return;
    var rows=[];
    battle.party.filter(function(actor){return actor.hp>0;}).forEach(function(actor){
      var item=create('div');item.className='party-command';
      var title=create('p');
      title.textContent=actor.name+' · HP '+actor.hp+'/'+actor.maxHp+
        ' · MP '+actor.mp+'/'+actor.maxMp;
      item.appendChild(title);
      var skillLabel=create('label');
      skillLabel.textContent=actor.name+' ability';
      var skill=create('select');
      skill.setAttribute('aria-label',actor.name+' ability');
      skill.setAttribute('data-party-skill',actor.id);
      var available=actor.skills.filter(function(id){
        var meta=skillBook[id];return !!meta&&actor.mp>=meta.cost;
      }).map(function(id){return {id:id,name:id+' · '+skillBook[id].cost+' MP'};});
      fillOptions(skill,available);
      skillLabel.appendChild(skill);item.appendChild(skillLabel);
      var targetLabel=create('label');targetLabel.textContent=actor.name+' target';
      var target=create('select');
      target.setAttribute('aria-label',actor.name+' target');
      target.setAttribute('data-party-target',actor.id);
      targetLabel.appendChild(target);item.appendChild(targetLabel);
      function updateTargets(){
        var chosen=skillBook[skill.value];
        var options=chosen&&chosen.kind==='heal'?battle.party:
          chosen&&chosen.kind==='guard'?[actor]:battle.foes;
        fillOptions(target,options.filter(function(a){return a.hp>0;})
          .map(function(a){return {id:a.id,name:a.name+' · HP '+a.hp};}));
        if(chosen&&chosen.kind==='guard')target.disabled=true;
      }
      skill.addEventListener('change',updateTargets);
      updateTargets();
      root.appendChild(item);
      rows.push({actor:actor.id,skill:skill,target:target});
    });
    if(!rows.length)return;
    var commit=create('button');commit.id='party-commit';commit.type='button';
    commit.textContent='Commit selected party actions';
    commit.disabled=rows.some(function(r){return !r.skill.value||!r.target.value;});
    commit.addEventListener('click',function(){
      var orders=rows.map(function(row){
        return {actor:row.actor,skill:row.skill.value,target:row.target.value};
      });
      var result=probe.submit(orders);
      // The integrated host may synchronously rebuild this panel AND apply
      // its landscape pagination during notify. Never render a second time
      // afterward: it would erase the newly installed page navigation.
      // Returning true from notify means the host owns the UI refresh.
      var handled=typeof notify==='function'&&notify(result)===true;
      if(!handled)render();
    });
    root.appendChild(commit);
  }
  return Object.freeze({render:render});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframePartyCommandPanel;
