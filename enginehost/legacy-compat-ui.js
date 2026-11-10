/* Opt-in on-device UI for the frozen original game rules.
 * All actions use a separate portable journal. No route back to the original
 * ExpeditionActivity preferences is exposed by this module.
 */
function attachBearframeLegacyCompatibilityUI(config){
  var ids=['legacy-compat-preview','legacy-compat-confirm','legacy-compat-resume'];
  var preview=document.getElementById(ids[0]),confirm=document.getElementById(ids[1]),
    resume=document.getElementById(ids[2]),status=document.getElementById('legacy-compat-status'),
    board=document.getElementById('legacy-compat-board'),
    controls=document.getElementById('legacy-compat-actions');
  var compat=createBearframeLegacyCompatibility(config);
  var exportButton=document.getElementById('legacy-compat-export');
  var importButton=document.getElementById('legacy-compat-import-file');
  var importConfirm=document.getElementById('legacy-compat-import-confirm');
  var nativeExport=window.BearframeArchiveExport&&
    typeof window.BearframeArchiveExport.beginCompatExport==='function'?
    window.BearframeArchiveExport:null;
  exportButton.addEventListener('click',function(){
    if(!nativeExport||!nativeExport.beginCompatExport())
      text('Current historical progress cannot be exported until a verified playable save exists.');
    else text('Select a file for your continued historical progress. The original remains intact.');
  });
  importButton.addEventListener('click',function(){
    // A canceled or replaced document selection can never reuse stale consent.
    compat.cancelFile();
    importConfirm.disabled=true;
    if(!nativeExport||
       typeof nativeExport.beginCompatRestore!=='function'||
       !nativeExport.beginCompatRestore())
      text('Recovery refused: an existing compatibility save or no document picker.');
    else text('Select your exported historical JSON. Another confirmation is required.');
  });
  importConfirm.addEventListener('click',function(){
    importConfirm.disabled=true;
    var result=compat.commitFile();
    text(result.ok?
      'Continued historical progress durably recovered. Original launcher save unchanged.':
      'Continued save recovery refused: '+result.reason);
    if(result.ok){
      resume.disabled=false;importButton.disabled=true;
      exportButton.disabled=!nativeExport;draw();
    }
  });
  function text(v){status.textContent=String(v);}
  function draw(){
    var snap=compat.snapshot(),s=snap.legacy;
    if(!s){board.textContent='No compatible session loaded.';controls.textContent='';return;}
    var area=config.world.WORLD[s.area],rows=area.rows.slice();
    rows[s.y]=rows[s.y].slice(0,s.x)+'@'+rows[s.y].slice(s.x+1);
    board.textContent=s.name+' · '+area.name+' · Save revision '+snap.sequence+'\n'+
      rows.join('\n')+'\nHP '+s.hp+' · Charge '+s.charge+' · '+(s.weapon||'unarmed')+
      '\n'+s.message;
    controls.textContent='';
    var choices=s.battle?[
      ['strike','Strike'],['pulse','Pulse'],['guard','Guard'],['withdraw','Withdraw']
    ].map(function(it){return {type:'combat',value:it[0],title:it[1]};}):
    s.prompt?config.world.ACTIONS[s.prompt].map(function(it){
      return {type:'choose',value:it[0],title:it[1]};
    }).concat([{type:'close',title:'Close prompt'}]):[
      {type:'move',value:'up',title:'Up'},
      {type:'move',value:'left',title:'Left'},
      {type:'move',value:'down',title:'Down'},
      {type:'move',value:'right',title:'Right'},
      {type:'rest',title:'Rest (at berth)'}
    ];
    choices.forEach(function(action){
      var button=document.createElement('button');
      button.type='button';button.textContent=action.title;
      button.setAttribute('aria-label','Legacy '+action.title);
      button.addEventListener('click',function(){
        var result=compat.dispatch({type:action.type,value:action.value});
        if(!result.ok&&result.reason!=='no-change')
          text('Legacy action refused: '+result.reason);
        else text(result.ok?'Legacy progress saved. Original save unchanged.':
          'No movement or action at this location.');
        draw();
      });
      controls.appendChild(button);
    });
  }
  preview.addEventListener('click',function(){
    var result=compat.preflight();
    confirm.disabled=!result.ok;
    text(result.ok?
      'Ready to copy archived original progress at '+result.location+
      ' ('+result.x+','+result.y+'). This does not modify the original. Confirm to begin.':
      'Compatibility import unavailable: '+result.reason);
  });
  confirm.addEventListener('click',function(){
    confirm.disabled=true;
    var result=compat.commit();
    text(result.ok?'Playable historical progress copied and durably verified. Original unchanged.':
      'Import refused: '+result.reason);
    if(result.ok){resume.disabled=false;importButton.disabled=true;
      exportButton.disabled=!nativeExport;draw();}
  });
  resume.addEventListener('click',function(){
    var result=compat.resume();
    text(result.ok?'Historical session resumed from verified separate save.':
      'Resume refused: '+result.reason);
    if(result.ok){exportButton.disabled=!nativeExport;draw();}
  });
  // Existing compatibility journal is read-only on startup; user must press
  // Resume to enter it. Old-save import never runs implicitly.
  var health=compat.snapshot().health;
  resume.disabled=health.validSlots===0||health.conflict;
  exportButton.disabled=!nativeExport||health.validSlots===0||health.conflict;
  importButton.disabled=!nativeExport||health.occupiedSlots!==0||health.conflict;
  draw();
  window.BearframeLegacyCompat=Object.freeze({
    snapshot:compat.snapshot,
    snapshotJson:function(){return JSON.stringify(compat.snapshot());},
    preflight:compat.preflight,
    resume:compat.resume,
    onFileSelected:function(){
      if(!nativeExport||
         typeof nativeExport.takeCompatRestore!=='function'){
        text('Continued file recovery bridge unavailable.');
        return;
      }
      var raw=nativeExport.takeCompatRestore();
      var inspected=compat.inspectFile(raw);
      importConfirm.disabled=!inspected.ok;
      text(inspected.ok?
        'Validated '+inspected.name+' at '+inspected.location+
        ' ('+inspected.x+','+inspected.y+'). Confirm to recover this progress.':
        'Continued save file refused: '+inspected.reason);
    }
  });
  return compat;
}
if(typeof module!=='undefined'&&module.exports)
 module.exports=attachBearframeLegacyCompatibilityUI;
