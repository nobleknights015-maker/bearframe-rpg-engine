/* Historical Rhino ExpeditionActivity v1 save snapshot decoder.
 * Engine migration boundary only. This does not translate legacy world state,
 * authorize writes, or initialize a new game session.
 * Always run the original legacy game's restore() validator before any future
 * project-specific mapping. Structural decoding is not gameplay verification.
 */
var BearframeLegacyV1=(function(){
  var own=Object.prototype.hasOwnProperty;
  var fields=['v','name','finish','area','x','y','hp','charge',
    'weapon','flags','battle','prompt','message'];
  var flagNames=['bearing','E','D','H','echoAlly','gridAlly','met'];
  var foes={H:24,E:20,D:22};
  function exact(o,keys) {
    if(!o||typeof o!=='object'||Array.isArray(o))return false;
    var present=Object.keys(o);
    if(present.length!==keys.length)return false;
    for(var i=0;i<keys.length;i++)if(!own.call(o,keys[i]))return false;
    return true;
  }
  function int(n,low,high){return Number.isInteger(n)&&n>=low&&n<=high;}
  function decode(raw) {
    if(typeof raw!=='string'||!raw.length||raw.length>1900000)
      throw new TypeError('Missing or oversized legacy save');
    var s;
    try{s=JSON.parse(raw);}catch(error){throw new TypeError('Invalid legacy JSON');}
    if(!exact(s,fields)||s.v!==1||
      typeof s.name!=='string'||!s.name.trim()||s.name.length>18||
      ['Ash','Slate','Ivory'].indexOf(s.finish)<0||
      ['pod','gallery','ridge'].indexOf(s.area)<0||
      !int(s.x,0,12)||!int(s.y,0,7)||
      !int(s.hp,1,s.flags&&s.flags.bearing===true?36:30)||
      !int(s.charge,0,3)||
      !(s.weapon===null||s.weapon==='blade'||s.weapon==='lance')||
      typeof s.message!=='string'||s.message.length>1000||
      !exact(s.flags,flagNames))
      throw new TypeError('Unsupported legacy v1 fields');
    for(var i=0;i<flagNames.length;i++){
      if(typeof s.flags[flagNames[i]]!=='boolean')
        throw new TypeError('Invalid legacy flags');
    }
    if((s.flags.echoAlly&&!s.flags.E)||(s.flags.gridAlly&&!s.flags.D))
      throw new TypeError('Inconsistent legacy ally flags');
    if(s.prompt!==null &&
      ['G','C','E','T','D','H','M'].indexOf(s.prompt)<0)
      throw new TypeError('Invalid legacy prompt');
    if(s.battle!==null){
      if(!exact(s.battle,['key','hp','turn'])||
         !own.call(foes,s.battle.key)||!int(s.battle.hp,1,foes[s.battle.key])||
         !int(s.battle.turn,1,Number.MAX_SAFE_INTEGER)||s.prompt!==null)
        throw new TypeError('Invalid legacy battle');
    }
    // The returned value is only a verified historical envelope. It has not
    // passed the old world/tile validator or a new project-specific mapper.
    return s;
  }
  function inspect(raw){
    try{
      var s=decode(raw);
      return {ok:true,version:1,name:s.name,finish:s.finish,area:s.area,
        x:s.x,y:s.y,inBattle:s.battle!==null,hasPrompt:s.prompt!==null};
    }catch(error){
      return {ok:false,reason:'missing-or-incompatible'};
    }
  }
  return Object.freeze({decode:decode,inspect:inspect});
}());
if(typeof module!=='undefined'&&module.exports)module.exports=BearframeLegacyV1;
