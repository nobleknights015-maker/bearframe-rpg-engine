// Small, authored pixel shapes. Each frame is drawn on demand at a fixed resolution.
const scenery={};
for(const area of Object.keys(WORLD)){
  const img=new Image();img.src=area+'.webp';scenery[area]=img;
}
function paint(canvas,s){
  const c=canvas.getContext('2d'), map=WORLD[s.area], w=canvas.width,h=canvas.height;
  const rect=(x,y,a,b,color)=>{c.fillStyle=color;c.fillRect(x|0,y|0,a,b)};
  function poly(points,color){
    c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();
  }
  function frame(x,y,style,weapon,scale=1){
    c.save();c.translate(x,y);c.scale(scale,scale);
    const colors={Ash:['#b6acb4','#796b79','#b598ff'],Ivory:['#ddd9cf','#988e88','#c5a8ff'],Slate:['#8c96a4','#515968','#b89cff'],
      E:['#ac907c','#62574e','#f6ad71'],H:['#ece6df','#756f78','#ff656d'],G:['#a0a2ad','#575d6b','#eee1ab'],M:['#d5e5e1','#738f94','#6cd9cc']};
    const [armor,dark,light]=colors[style]||colors.Ash, joint='#252433';
    rect(-6,0,14,2,'#262633');
    if(style==='D'){
      for(const sign of [-1,1]){rect(sign*5-2,-5,3,5,'#687b80');rect(sign*6-2,-2,4,2,'#a2aa9d')}
      poly([[-8,-7],[-4,-12],[3,-13],[8,-8],[6,-4],[-6,-4]],'#53676d');
      rect(-4,-10,7,2,'#8ad5d3');rect(2,-14,2,3,'#a4b8af');c.restore();return;
    }
    for(const k of [-1,1]){
      rect(k*3-1,-10,3,8,joint);rect(k*3-1,-5,3,4,dark);rect(k*3-2,-2,4,2,armor);
    }
    poly([[-5,-16],[-3,-19],[4,-19],[6,-15],[3,-10],[-2,-9]],dark);
    poly([[-4,-17],[1,-19],[4,-17],[2,-14],[-2,-13]],armor);
    rect(-2,-14,3,1,light);
    for(const k of [-1,1]){rect(k*6-1,-16,3,6,joint);rect(k*6-1,-17,4,3,armor);rect(k*6-1,-12,2,4,dark)}
    poly([[-5,-22],[-3,-26],[2,-27],[5,-24],[4,-19],[1,-18],[-3,-20]],armor);
    poly([[-3,-24],[5,-23],[3,-20],[0,-20]],joint);rect(0,-22,4,1,light);
    if(weapon==='blade')poly([[7,-9],[13,-19],[12,-14],[8,-8]],'#bca7ef');
    if(weapon==='lance'){rect(7,-23,2,18,'#a49eac');poly([[7,-23],[8,-28],[10,-23]],'#dac0ff')}
    c.restore();
  }
  function feature(k,x,y){
    if('GEDHM'.includes(k)){frame(x,y,k,null,k==='G'?1.18:0.85);return}
    if(k==='P'){rect(x-9,y-5,18,5,'#222433');rect(x-7,y-6,14,2,'#bc9bde')}
    if(k==='C'||k==='T'){rect(x-6,y-10,12,9,'#282a35');rect(x-7,y-11,13,3,'#88929a');rect(x-4,y-7,6,2,k==='C'?'#dcc29a':'#74989a')}
    if(k==='>'||k==='<'){rect(x-7,y-3,14,2,map.light);rect(x-4,y-6,8,1,map.light)}
  }
  rect(0,0,w,h,map.sky);
  if(s.battle){
    const img=scenery[s.area];
    if(img.complete&&img.naturalWidth)c.drawImage(img,0,0,w,h);
    rect(0,h-20,w,20,'#18172355');
    frame(66,126,s.finish,s.weapon,2.25);frame(214,115,s.battle.key,null,2.7);
    return;
  }
  const img=scenery[s.area];
  if(img.complete&&img.naturalWidth)c.drawImage(img,0,0,w,68);
  const tw=22,th=15,ox=5,oy=79;
  for(let y=0;y<map.rows.length;y++)for(let x=0;x<map.rows[y].length;x++){
    const k=map.rows[y][x],px=ox+x*tw,py=oy+y*th,v=(x*13+y*7)%6;
    rect(px,py,tw-1,th-1,map.stone);rect(px+2,py+2,tw-5,1,'#ffffff15');
    rect(px+v*2,py+10,7,1,'#00000020');
    if(k==='#'){
      const z=(s.area==='ridge'?5:10)+v%3;
      poly([[px,py+2],[px+4,py-z],[px+tw-2,py-z-1],[px+tw-1,py+1]],s.area==='ridge'?'#87717a':'#777083');
      rect(px+1,py+2,tw-2,9,'#373544');rect(px+3,py+3,tw-7,1,'#a09ba2');
      if(s.area!=='ridge'&&v===1)rect(px+6,py+5,6,1,map.light)
    }else{
      if(!s.flags[k]&&!(k==='M'&&s.flags.met))feature(k,px+11,py+12);
      if(s.x===x&&s.y===y)frame(px+10,py+13,s.finish,s.weapon,0.78);
    }
  }
}
