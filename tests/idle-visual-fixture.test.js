const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),zlib=require('node:zlib');
const path=require('node:path');
// Read our tiny, original public-safe PNG fixture without third-party packages.
function pngRgba(){
 const encoded=fs.readFileSync(path.join(__dirname,
  '../enginehost/fixtures/characters.png.b64'),'utf8').trim();
 const src=Buffer.from(encoded,'base64');
 assert.equal(src.subarray(1,4).toString('ascii'),'PNG');
 let offset=8,width=0,height=0,depth=0,type=0,fragments=[];
 while(offset<src.length){
  const size=src.readUInt32BE(offset);offset+=4;
  const id=src.toString('ascii',offset,offset+4);offset+=4;
  const data=src.subarray(offset,offset+size);offset+=size+4;
  if(id==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);
   depth=data[8];type=data[9];}
  if(id==='IDAT')fragments.push(data);
  if(id==='IEND')break;
 }
 assert.equal(depth,8);assert.equal(type,6,'source must remain RGBA');
 const raw=zlib.inflateSync(Buffer.concat(fragments)),stride=width*4;
 const pixels=Buffer.alloc(stride*height);
 for(let y=0;y<height;y++){
  const filter=raw[y*(stride+1)];assert.ok(filter>=0&&filter<=4);
  for(let x=0;x<stride;x++){
   const i=y*stride+x,left=x>=4?pixels[i-4]:0;
   const up=y>0?pixels[i-stride]:0,ul=x>=4&&y>0?pixels[i-stride-4]:0;
   let pred=0;
   if(filter===1)pred=left;
   if(filter===2)pred=up;
   if(filter===3)pred=Math.floor((left+up)/2);
   if(filter===4){const v=left+up-ul,a=Math.abs(v-left),b=Math.abs(v-up),
    c=Math.abs(v-ul);pred=a<=b&&a<=c?left:b<=c?up:ul;}
   pixels[i]=(raw[y*(stride+1)+1+x]+pred)&255;
  }
 }
 return {width,height,pixels};
}
test('packaged diagnostic idle atlas has two visually DISTINCT clean 32x48 pixel frames',()=>{
 const image=pngRgba();
 assert.equal(image.width,64);assert.equal(image.height,48);
 let changed=0;
 for(let y=0;y<48;y++)for(let x=0;x<32;x++){
  const a=(y*64+x)*4,b=(y*64+x+32)*4;
  assert.equal(image.pixels[a+3],image.pixels[b+3],
   'visual animation must preserve clean silhouette/alpha');
  assert.ok(image.pixels[a+3]===0||image.pixels[a+3]===255,
   'fixture must not be blurred/partly transparent');
  for(let ch=0;ch<3;ch++)
   if(image.pixels[a+ch]!==image.pixels[b+ch]){changed++;break;}
 }
 assert.equal(changed,90,'small deliberate visor pulse has distinct pixels');
});
