const test=require('node:test');
const assert=require('node:assert/strict');
const create=require('../enginehost/landscape-layout');

test('Android visual viewport pan repositions the stage without changing the durable model',()=>{
  const listeners={};
  const visualViewport={width:917,height:411,offsetLeft:0,offsetTop:0,
    addEventListener:(event,fn)=>{listeners[event]=fn;}};
  const window={innerWidth:917,innerHeight:411,visualViewport,
    addEventListener(){},
    getComputedStyle:()=>({paddingTop:'0px',paddingRight:'0px',
      paddingBottom:'0px',paddingLeft:'0px'})};
  const classes=()=>({toggle(){}});
  const document={defaultView:window,body:{classList:classes(),appendChild(){}},
    documentElement:{classList:classes()},getElementById:()=>null,
    createElement:()=>({setAttribute(){}})};
  const stage={ownerDocument:document,style:{}};
  const layout=create(stage,window);
  const initial=layout.snapshot();
  assert.equal(typeof listeners.scroll,'function',
    'Android visualViewport scrolling must be observed independently of resize');
  assert.equal(typeof listeners.resize,'function');
  visualViewport.offsetLeft=37;
  visualViewport.offsetTop=12;
  listeners.scroll();
  assert.equal(layout.snapshot().scale,initial.scale);
  assert.equal(layout.snapshot().stageWidth,initial.stageWidth);
  assert.equal(layout.snapshot().stageHeight,initial.stageHeight);
  assert.equal(stage.style.transform,
    'translate('+(initial.offsetX+37)+'px,'+
      (initial.offsetY+12)+'px) scale('+initial.scale+')');
  visualViewport.offsetLeft=0;
  visualViewport.offsetTop=0;
  listeners.scroll();
  assert.equal(stage.style.transform,
    'translate('+initial.offsetX+'px,'+initial.offsetY+'px) scale('+initial.scale+')');
});
