/* Opt-in, deterministic, renderer-independent party level curves.
 * Pure rules: no clock, storage, gameplay ownership, or UI.
 * Thresholds define cumulative XP for levels 1..N, starting at zero.
 */
function createBearframeProgression(config,skills,templates){
  var own=Object.prototype.hasOwnProperty;
  function has(o,k){return !!o&&own.call(o,k);}
  function number(n,lo,hi){return Number.isInteger(n)&&n>=lo&&n<=hi;}
  function record(x){return x&&typeof x==='object'&&!Array.isArray(x);}
  function clone(x){return JSON.parse(JSON.stringify(x));}
  if(!record(config)||!Array.isArray(config.thresholds)||
     config.thresholds.length<1||config.thresholds.length>100||
     config.thresholds[0]!==0||!record(config.growth)||
     !record(templates)||!record(skills))
    throw new TypeError('Invalid party progression configuration');
  var thresholds=config.thresholds.slice();
  for(var i=0;i<thresholds.length;i++)
    if(!number(thresholds[i],0,2147483647)||
       i>0&&thresholds[i]<=thresholds[i-1])
      throw new TypeError('XP thresholds must be strictly increasing integers');
  var actors=Object.keys(templates),growth={},unlocks={};
  var fields=['hp','mp','attack','defense','speed'];
  if(Object.keys(config.growth).length!==actors.length)
    throw new TypeError('One progression growth profile required per actor');
  actors.forEach(function(id){
    var g=config.growth[id];
    if(!record(g)||Object.keys(g).length!==fields.length)
      throw new TypeError('Missing growth profile '+id);
    var valid={};
    fields.forEach(function(field){
      if(!has(g,field)||!number(g[field],0,999))
        throw new TypeError('Invalid '+field+' growth '+id);
      valid[field]=g[field];
    });
    growth[id]=valid;
  });
  var rawUnlocks=config.unlocks===undefined?{}:config.unlocks;
  if(!record(rawUnlocks))throw new TypeError('Invalid level unlock catalog');
  Object.keys(rawUnlocks).forEach(function(id){
    if(!has(templates,id)||!record(rawUnlocks[id]))
      throw new TypeError('Unknown actor in level unlocks '+id);
    var seen={},starting=templates[id].skills;
    if(!Array.isArray(starting))throw new TypeError('Actor skills required');
    starting.forEach(function(key){seen[key]=true;});
    var byLevel={};
    Object.keys(rawUnlocks[id]).sort(function(a,b){return Number(a)-Number(b);}).forEach(function(lvl){
      var n=Number(lvl),items=rawUnlocks[id][lvl];
      if(String(n)!==lvl||!number(n,2,thresholds.length)||!Array.isArray(items)||
         items.length<1||items.length>50)
        throw new TypeError('Invalid skill level unlock '+id+'/'+lvl);
      items.forEach(function(key){
        if(typeof key!=='string'||!has(skills,key)||has(seen,key))
          throw new TypeError('Unknown or duplicated unlocked skill '+key);
        seen[key]=true;
      });
      byLevel[n]=items.slice();
    });
    unlocks[id]=byLevel;
  });
  function level(xp){
    if(!number(xp,0,2147483647))throw new TypeError('Invalid experience points');
    var n=1;
    while(n<thresholds.length&&xp>=thresholds[n])n++;
    return n;
  }
  function info(xp){
    var l=level(xp);
    return {xp:xp,level:l,nextLevelXp:l<thresholds.length?thresholds[l]:null};
  }
  function derive(id,base,xp,isLead){
    if(!has(growth,id)||!base||base.id!==id)
      throw new TypeError('Unknown progression actor '+id);
    var l=level(xp),g=growth[id],a=clone(base),n=l-1;
    a.maxHp=Math.min(isLead?9999:99999,base.maxHp+g.hp*n);
    a.maxMp=Math.min(isLead?999:9999,base.maxMp+g.mp*n);
    a.attack=Math.min(9999,base.attack+g.attack*n);
    a.defense=Math.min(9999,base.defense+g.defense*n);
    a.speed=Math.min(9999,base.speed+g.speed*n);
    var unlock=unlocks[id]||{};
    for(var i=2;i<=l;i++)if(unlock[i])
      unlock[i].forEach(function(skill){a.skills.push(skill);});
    a.level=l;
    return a;
  }
  return Object.freeze({level:level,info:info,derive:derive,
    maxLevel:thresholds.length});
}
if(typeof module!=='undefined'&&module.exports)
  module.exports=createBearframeProgression;
