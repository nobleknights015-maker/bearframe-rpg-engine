/* Bearframe unified engine: a single game session shared by WebView, Node and
 * Android/Rhino. UI, input and audio are platform adapters around this core.
 * All state transitions are committed to durable storage before presentation.
 */
function createBearframeSession(project, storage, theme, opts) {
  opts=opts||{};
  var node=(typeof module!=='undefined'&&module.exports);
  var engineFactory=node?require('./runtime.js'):createBearframeEngine;
  var journalFactory=node?require('./save-slots.js'):createBearframeSaveSlots;
  var sceneFactory=node?require('./scene.js'):createBearframeSceneComposer;
  var engine=engineFactory(project);
  var journal=journalFactory(engine,storage,opts.slotPrefix);
  var scene=theme?sceneFactory(project,theme):null;
  var current=null,lastError=null;
  function result(ok,reason) {
    return {ok:ok,reason:reason||null,
      sequence:current?current.sequence:null,
      save:journal.health()};
  }
  function resume() {
    var health=journal.health();
    if(health.conflict){lastError='save-conflict';return result(false,lastError);}
    var recovered=journal.load();
    if(!recovered) {
      current=null;lastError=health.validSlots===0?'no-save':'unreadable-save';
      return result(false,lastError);
    }
    current=recovered;lastError=null;
    return result(true);
  }
  function start(name,seed) {
    var health=journal.health();
    if(health.conflict||health.validSlots>0)
      return result(false,'existing-save');
    var first=engine.fresh(name,seed);
    var committed=journal.save(first);
    if(!committed.ok){lastError=committed.reason;return result(false,lastError);}
    current=first;lastError=null;
    return result(true);
  }
  function dispatch(action) {
    if(!current)return result(false,'not-started');
    var next;
    try {next=engine.step(current,action);}
    catch(error){lastError='simulation-error';return result(false,lastError);}
    if(next===current)return result(false,'no-change');
    var committed=journal.save(next);
    if(!committed.ok){lastError=committed.reason;return result(false,lastError);}
    current=next;lastError=null;
    return result(true);
  }
  function snapshot() {
    return {started:!!current,error:lastError,project:engine.projectId,
      engineVersion:engine.version,view:current?engine.view(current):null,
      journal:journal.health()};
  }
  function compose(options) {
    if(!scene||!current)throw new Error('Session rendering unavailable');
    return scene.compose(engine.view(current),options);
  }
  function serialize() {return current?engine.serialize(current):null;}
  return Object.freeze({resume:resume,start:start,dispatch:dispatch,
    snapshot:snapshot,compose:compose,serialize:serialize});
}
if(typeof module!=='undefined'&&module.exports)module.exports=createBearframeSession;
