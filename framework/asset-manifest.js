/* Bearframe Engine Kit: versioned, game-neutral asset manifest contract.
 * Inspired by the descriptor registry in Chris's Engine v1 AssetManager.
 * https://github.com/nobleknights015-maker/Plushbound-Legends-mobile/blob/engine-v1-rebuild/engine/src/assets/AssetManager.js
 *
 * This module validates metadata only: no browser, image, filesystem,
 * network, or Android APIs. It can run in Node, Rhino and WebView.
 */
function validateBearframeAssets(manifest) {
  var own=Object.prototype.hasOwnProperty;
  function has(o,k){return !!o&&own.call(o,k);}
  var ids=/^[a-z][a-z0-9_-]{0,63}$/;
  var allowed=/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(png|webp|jpg|jpeg|ogg|wav|mp3)$/;
  var typeExt={
    atlas:{png:true,webp:true,jpg:true,jpeg:true},
    image:{png:true,webp:true,jpg:true,jpeg:true},
    music:{ogg:true,wav:true,mp3:true},
    sfx:{ogg:true,wav:true,mp3:true}
  };
  function isInt(x,min,max){return Number.isInteger(x)&&x>=min&&x<=max;}
  function record(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
  if(!record(manifest)||manifest.version!==1||!record(manifest.assets))
    throw new TypeError('Asset manifest must have version 1 and assets record');
  var keys=Object.keys(manifest.assets);
  if(keys.length>4096)throw new TypeError('Asset manifest exceeds 4096 entries');
  var seenPaths={};
  keys.forEach(function(id){
    if(!ids.test(id))throw new TypeError('Invalid asset id '+id);
    var d=manifest.assets[id];
    if(!record(d)||!has(typeExt,d.type)||typeof d.path!=='string'||
      d.path.length>192||!allowed.test(d.path))
      throw new TypeError('Invalid asset descriptor '+id);
    var ext=d.path.split('.').pop();
    if(!has(typeExt[d.type],ext))
      throw new TypeError('Incompatible asset type and extension '+id);
    if(has(seenPaths,d.path))throw new TypeError('Duplicate asset path '+d.path);
    seenPaths[d.path]=true;
    if(d.type==='atlas'||d.type==='image') {
      if(!isInt(d.width,1,8192)||!isInt(d.height,1,8192)||
        d.width*d.height>16777216)
        throw new TypeError('Invalid image dimensions '+id);
      if(d.pixelArt!==undefined&&typeof d.pixelArt!=='boolean')
        throw new TypeError('Invalid pixel-art flag '+id);
    } else if(has(d,'width')||has(d,'height')||has(d,'pixelArt')) {
      throw new TypeError('Audio asset cannot have image dimensions '+id);
    } else if(!has(d,'bytes')) {
      // Audio cache residency is budgeted from declared encoded bytes.
      // Without a positive budget, arbitrarily many audio resources could
      // occupy the cache while reporting zero memory consumption.
      throw new TypeError('Audio asset requires byte budget '+id);
    }
    if(d.preload!==undefined&&typeof d.preload!=='boolean')
      throw new TypeError('Invalid preload flag '+id);
    if(d.bytes!==undefined&&!isInt(d.bytes,1,134217728))
      throw new TypeError('Invalid file byte budget '+id);
    Object.keys(d).forEach(function(k){
      if(['type','path','width','height','preload','pixelArt','bytes'].indexOf(k)<0)
        throw new TypeError('Unknown asset metadata '+id+'.'+k);
    });
  });
  return manifest;
}
if(typeof module!=='undefined'&&module.exports)module.exports=validateBearframeAssets;
