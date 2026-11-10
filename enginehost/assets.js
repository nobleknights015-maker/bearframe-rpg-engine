/* Synthetic atlas descriptors used only to test the engine asset pipeline.
 * Production games supply their own validated manifest; no Bearframe story data.
 */
var BEARFRAME_HOST_ASSETS={
  version:1,
  assets:{
    terrain:{type:'atlas',path:'enginehost/assets/terrain.png',
      width:64,height:32,pixelArt:true,preload:true},
    characters:{type:'atlas',path:'enginehost/assets/characters.png',
      width:64,height:48,pixelArt:true,preload:true}
  }
};
