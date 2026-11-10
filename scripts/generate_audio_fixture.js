/* Deterministic, original, silent 0.25-second PCM WAV fixture.
 * No external samples, copyrighted media, network fetches or binary blobs.
 * Used solely for offline audio pipeline diagnostics.
 */
function makeSilentWav(){
  var sampleRate=8000,frames=2000,channels=1,bits=16;
  var dataSize=frames*channels*bits/8;
  var b=Buffer.alloc(44+dataSize);
  b.write('RIFF',0,'ascii');b.writeUInt32LE(36+dataSize,4);
  b.write('WAVEfmt ',8,'ascii');b.writeUInt32LE(16,16);
  b.writeUInt16LE(1,20);b.writeUInt16LE(channels,22);
  b.writeUInt32LE(sampleRate,24);
  b.writeUInt32LE(sampleRate*channels*bits/8,28);
  b.writeUInt16LE(channels*bits/8,32);b.writeUInt16LE(bits,34);
  b.write('data',36,'ascii');b.writeUInt32LE(dataSize,40);
  return b;
}
if(require.main===module){
  var fs=require('node:fs'),path=require('node:path');
  if(process.argv.length!==3)throw Error('Usage: node scripts/generate_audio_fixture.js <output.wav>');
  var output=path.resolve(process.argv[2]);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,makeSilentWav(),{flag:'w'});
}
module.exports=makeSilentWav;
