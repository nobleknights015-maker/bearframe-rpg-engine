/* Test-only target project derived from existing original legacy world.
 * No new maps, story, art or gameplay are produced by this compatibility fixture.
 * This permits migration field-invariance tests; NOT gameplay parity proof.
 */
const original=require('../game/world');
const engine=require('../framework/runtime');
const maps={};
Object.keys(original.WORLD).forEach(id=>{
 const old=original.WORLD[id],events={},exits={};
 old.rows.forEach((row,y)=>[...row].forEach((cell,x)=>{
  const point=x+','+y;
  if(original.TEXT[cell])events[point]=cell.toLowerCase();
  if(old.exits[cell]){const to=old.exits[cell];exits[point]={map:to[0],x:to[1],y:to[2]};}
 }));
 maps[id]={name:old.name,
   rows:old.rows.map(row=>row.replace(/[^#]/g,'.')),
   events,exits,encounters:{}};
});
const events={};
Object.keys(original.ACTIONS).forEach(key=>{
 events[key.toLowerCase()]={text:original.TEXT[key],choices:original.ACTIONS[key].map(([id,title])=>({
   id,text:title,effects:[]}))};
});
const foes={};
Object.keys(original.FOES).forEach(id=>{
 foes[id.toLowerCase()]={name:original.FOES[id].name,hp:original.FOES[id].hp,
   attack:original.FOES[id].power,period:original.FOES[id].period};
});
const project={
 id:'migration-compat-test',
 start:{map:'pod',x:3,y:4},maps,events,
 items:{blade:{name:'Legacy test blade',kind:'weapon',power:0,maxStack:1},
   lance:{name:'Legacy test lance',kind:'weapon',power:0,maxStack:1}},
 foes,quests:{}
};
const mapping={
 maps:{pod:'pod',gallery:'gallery',ridge:'ridge'},
 weapons:{blade:'blade',lance:'lance'},
 foes:{H:'h',E:'e',D:'d'},
 prompts:{G:'g',C:'c',E:'e',T:'t',D:'d',H:'h',M:'m'},
 allies:{echoAlly:'echo',gridAlly:'grid'}
};
module.exports={project,mapping};
