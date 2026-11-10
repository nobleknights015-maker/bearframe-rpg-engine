/* Run under Mozilla Rhino against the same portable runtime sources. */
var partyEngine=createBearframeEngine(FRAMEWORK_PARTY_FIXTURE);
if(partyEngine.version!==2)throw new Error('Missing opt-in combat version');
var partyState=partyEngine.fresh('Rhino pilot',77);
for(var i=0;i<6;i++){
 var route=['down','down','right','right','up','up'];
 partyState=partyEngine.step(partyState,{type:'move',dir:route[i]});
}
if(!partyState.partyBattle||partyState.partyBattle.foe!=='crawler')
 throw new Error('Rhino party encounter missing');
var afterParty=partyEngine.step(partyState,{type:'party-round',
 orders:[{actor:'pilot',skill:'strike',target:'crawler'}]});
if(afterParty.sequence!==partyState.sequence+1 ||
 !partyEngine.restore(partyEngine.serialize(afterParty)))
 throw new Error('Rhino party round failed serialization');
print('PASS opt-in party runtime Rhino');
