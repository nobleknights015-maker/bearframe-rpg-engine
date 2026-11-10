/* Synthetic opt-in v2 party-combat schema; NOT a Bearframe game map. */
var FRAMEWORK_PARTY_FIXTURE=JSON.parse(JSON.stringify(
  (typeof module!=='undefined'&&module.exports)?
    require('./engine-project.js'):FRAMEWORK_FIXTURE));
FRAMEWORK_PARTY_FIXTURE.id='framework-party-test';
FRAMEWORK_PARTY_FIXTURE.partyCombat={
  skills:{
    strike:{kind:'damage',power:6,cost:0,element:'physical'},
    pulse:{kind:'damage',power:12,cost:1,element:'arc'},
    mend:{kind:'heal',power:8,cost:1,element:'arc'},
    guard:{kind:'guard',power:0,cost:0,element:'physical'}
  },
  player:{id:'pilot',name:'Test pilot',hp:30,maxHp:30,mp:3,maxMp:3,
    attack:10,defense:4,speed:9,skills:['strike','pulse','mend','guard'],
    resistances:{},guarding:false,statuses:[]},
  allies:{
    scout:{id:'scout',name:'Test scout',hp:24,maxHp:24,mp:2,maxMp:2,
      attack:6,defense:2,speed:5,skills:['strike','mend'],
      resistances:{},guarding:false,statuses:[]}
  },
  enemies:{
    crawler:{id:'crawler',name:'Test target',hp:48,maxHp:48,mp:0,maxMp:0,
      attack:5,defense:2,speed:3,skills:['strike'],
      resistances:{},guarding:false,statuses:[]}
  }
};
if(typeof module!=='undefined'&&module.exports)
  module.exports=FRAMEWORK_PARTY_FIXTURE;
