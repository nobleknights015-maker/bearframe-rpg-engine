/* This file runs in Mozilla Rhino, not Node. */
function ensure(ok,label){if(!ok)throw new Error('Framework/Rhino: '+label);}
var engine=createBearframeEngine(FRAMEWORK_FIXTURE);
var state=engine.fresh('Rhino',91);
ensure(engine.validateState(state),'starting state');
var cache={},store={
 read:function(k){return Object.prototype.hasOwnProperty.call(cache,k)?cache[k]:null;},
 write:function(k,v){cache[k]=v;return true;}
};
var journal=createBearframeSaveSlots(engine,store);
ensure(journal.save(state).ok,'durable initial save');
var prompt=engine.step(state,{type:'move',dir:'right'});
ensure(prompt.prompt&&prompt.prompt.event==='supply','event interaction');
var gear=engine.step(prompt,{type:'choose',id:'collect'});
ensure(gear.inventory.blade===1&&gear.quests.survey===0,'scripted effects');
ensure(journal.save(gear).ok,'second save');
ensure(engine.restore(engine.serialize(gear)).sequence===gear.sequence,'state round trip');
ensure(journal.load().sequence===gear.sequence,'journal recovery');
var move=engine.step(gear,{type:'move',dir:'right'});
ensure(move.player.x===2,'completed event becomes walkable');
var fight=engine.step(move,{type:'move',dir:'right'});
ensure(fight.battle&&fight.battle.foe==='crawler','scripted encounter');
var turn=engine.step(fight,{type:'combat',id:'pulse'});
ensure(turn.battle&&turn.battle.turn===2,'combat round');
ensure(journal.save(turn).ok,'turn persisted');
ensure(journal.load().battle.turn===2,'turn recovered');
print('PASS portable JRPG framework and crash-resistant save journal under Rhino');
