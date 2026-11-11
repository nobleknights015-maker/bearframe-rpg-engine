/* Synthetic v2 full-world integration fixture. Never game/campaign content. */
var FRAMEWORK_PARTY_WORLD_FIXTURE=JSON.parse(JSON.stringify(
  (typeof module!=='undefined'&&module.exports)?
    require('./party-engine-project.js'):FRAMEWORK_PARTY_FIXTURE));
FRAMEWORK_PARTY_WORLD_FIXTURE.id='framework-party-world-test';
FRAMEWORK_PARTY_WORLD_FIXTURE.contentRevision='party_world_1';
FRAMEWORK_PARTY_WORLD_FIXTURE.partyCombat.skills.focus={
  kind:'damage',power:16,cost:1,element:'physical'
};
FRAMEWORK_PARTY_WORLD_FIXTURE.partyCombat.progression={
  thresholds:[0,10,30],
  growth:{
    pilot:{hp:4,mp:1,attack:2,defense:1,speed:0},
    scout:{hp:3,mp:1,attack:1,defense:1,speed:1}
  },
  unlocks:{pilot:{2:['focus']},scout:{2:['pulse']}}
};
FRAMEWORK_PARTY_WORLD_FIXTURE.items.vest={
  name:'Test vest',kind:'armor',defense:3,maxStack:1
};
FRAMEWORK_PARTY_WORLD_FIXTURE.items.charm={
  name:'Test charm',kind:'accessory',attack:1,speed:1,maxStack:1
};
FRAMEWORK_PARTY_WORLD_FIXTURE.events.supply.choices[0].effects.push(
  {type:'give',item:'vest',qty:1},
  {type:'give',item:'charm',qty:1});
if(typeof module!=='undefined'&&module.exports)
  module.exports=FRAMEWORK_PARTY_WORLD_FIXTURE;
