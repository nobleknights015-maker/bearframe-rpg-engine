/* Portable engine test fixture; intentionally not a Bearframe story map. */
var FRAMEWORK_FIXTURE = {
  id:'framework-test',
  start:{map:'hub',x:1,y:1},
  maps:{
    hub:{name:'Engine hub',
      rows:['#######','#.....#','#.....#','#.....#','#######'],
      exits:{'5,1':{map:'field',x:1,y:1}},
      events:{'2,1':'supply','2,2':'mechanic'},
      encounters:{'3,1':'crawler'}},
    field:{name:'Engine field',
      rows:['#####','#...#','#...#','#####'],
      exits:{'1,2':{map:'hub',x:1,y:3}},
      events:{'2,1':'scout'},encounters:{}}
  },
  events:{
    supply:{once:true,text:'Open the supply cache?',choices:[
      {id:'collect',text:'Collect gear',effects:[
        {type:'give',item:'blade',qty:1},
        {type:'give',item:'patch',qty:2},
        {type:'quest',quest:'survey',stage:0},
        {type:'message',text:'Supplies recovered.'}]},
      {id:'leave',text:'Leave supplies',effects:[]}]},
    mechanic:{once:false,text:'Trade a patch for a repair?',choices:[
      {id:'trade',text:'Trade',effects:[{type:'take',item:'patch',qty:1},{type:'heal',amount:6},{type:'quest',quest:'survey',stage:1}]},
      {id:'restock',text:'Request too many patches',effects:[{type:'give',item:'patch',qty:5}]}
    ]},
    scout:{once:true,text:'A scout can join.',choices:[
      {id:'recruit',text:'Recruit',effects:[{type:'recruit',ally:'scout'},{type:'quest',quest:'survey',stage:2},{type:'flag',id:'met_scout',value:true}]},
      {id:'pass',text:'Decline',effects:[{type:'message',text:'Scout stays.'}]}
    ]}
  },
  items:{
    blade:{name:'Training blade',kind:'weapon',power:4,maxStack:1},
    patch:{name:'Patch kit',kind:'consumable',heal:12,maxStack:3},
    key:{name:'Service key',kind:'key',maxStack:1}
  },
  foes:{
    crawler:{name:'Training crawler',hp:24,attack:5,period:3}
  },
  quests:{survey:{stages:['Recover supplies','Survey the site','Return with scout']}}
};
if(typeof module!=='undefined'&&module.exports)module.exports=FRAMEWORK_FIXTURE;
