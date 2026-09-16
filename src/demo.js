/** Original synthetic scene. Its initial known mask is NOT an AI prediction. */
function rocket(ctx, x, y, scale, angle, mask = false) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
  const shape = (color, points) => { ctx.fillStyle = mask ? '#fff' : color; ctx.beginPath(); points.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fill(); };
  shape('#c46848', [[-37,29],[-63,69],[-62,97],[-32,76]]);
  shape('#b55740', [[37,29],[63,69],[62,97],[32,76]]);
  shape('#576c70', [[-24,78],[24,78],[25,97],[-25,97]]);
  shape('#e7ddd1', [[0,-99],[-34,-44],[-38,63],[-24,80],[24,80],[38,63],[34,-44]]);
  shape('#cc7555', [[0,-99],[-27,-56],[27,-56]]);
  if (!mask) {
    shape('#d3c9bb', [[15,-55],[29,-50],[38,63],[24,80],[11,80]]);
    ctx.fillStyle='#455d67';ctx.beginPath();ctx.arc(0,-14,24,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#8dbbc0';ctx.beginPath();ctx.arc(0,-14,17,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#d3efdf';ctx.beginPath();ctx.arc(-6,-20,6,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#eef6e0';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(1,-26);ctx.lineTo(11,-16);ctx.stroke();
    shape('#bb6c4e',[[-28,43],[28,43],[30,52],[-30,52]]);
    ctx.fillStyle='#b2b4a4';for(let row=0;row<3;row++)for(let col=0;col<4;col++)ctx.fillRect(-17+col*10,9+row*9,4,4);
    ctx.fillStyle='#d6c5ab';for(const px of [-25,25])for(const py of [-43,59]){ctx.beginPath();ctx.arc(px,py,2.2,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#3e545a';ctx.fillRect(-15,81,6,13);ctx.fillRect(9,81,6,13);
  }
  ctx.restore();
}
function motion(width, height, time) {
  return { x: width*.52 + Math.sin(time/2500)*width*.065, y: height*.49 + Math.sin(time/1700)*height*.017, scale: Math.min(width/640,height/480)*1.05, angle: Math.sin(time/2300)*.035 };
}
export function drawDemo(canvas, time = 0) {
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,s=w/640;
  ctx.clearRect(0,0,w,h);
  const wall=ctx.createLinearGradient(0,0,w,h);wall.addColorStop(0,'#d4d7c8');wall.addColorStop(1,'#aab5a0');ctx.fillStyle=wall;ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#dce1d24d';ctx.beginPath();ctx.moveTo(w*.1,0);ctx.lineTo(w*.5,0);ctx.lineTo(w*.72,h*.72);ctx.lineTo(w*.22,h*.72);ctx.fill();
  ctx.strokeStyle='#b6c0ac';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,h*.72);ctx.lineTo(w,h*.72);ctx.stroke();
  ctx.fillStyle='#b7bea9';ctx.fillRect(0,h*.72,w,h*.28);
  ctx.fillStyle='#c4c8b54d';ctx.fillRect(0,h*.75,w,h*.015);
  // Little shelf and a plant remain photographic-style, not pixelated.
  ctx.fillStyle='#8c967e';ctx.fillRect(w*.065,h*.475,w*.19,5*s);
  ctx.fillStyle='#949e80';ctx.fillRect(w*.075,h*.485,w*.007,h*.047);
  ctx.fillStyle='#98a875';ctx.beginPath();ctx.moveTo(w*.13,h*.475);ctx.lineTo(w*.12,h*.38);ctx.lineTo(w*.205,h*.38);ctx.lineTo(w*.195,h*.475);ctx.fill();
  for(let i=0;i<6;i++){const x=w*(.164+(i-2.5)*.012),y=h*(.31+(i%3)*.01);ctx.strokeStyle='#748962';ctx.lineWidth=2*s;ctx.beginPath();ctx.moveTo(w*.162,h*.39);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle=i%2?'#879e70':'#70865e';ctx.beginPath();ctx.ellipse(x,y,7*s,18*s,(i-2.5)*.4,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='#85917e';ctx.font=`${9*s}px monospace`;ctx.fillText('STILL REAL.',w*.08,h*.56);
  // A stack of tactile cubes, outside the selected subject.
  ctx.fillStyle='#b29172';ctx.fillRect(w*.79,h*.66,55*s,40*s);ctx.fillStyle='#c5a68b';ctx.fillRect(w*.80,h*.57,40*s,43*s);ctx.fillStyle='#d0ba9e';ctx.fillRect(w*.805,h*.56,40*s,8*s);
  const m=motion(w,h,time);ctx.fillStyle='#66775b23';ctx.beginPath();ctx.ellipse(m.x+7*s,h*.78,65*s,12*s,0,0,Math.PI*2);ctx.fill();
  rocket(ctx,m.x,m.y,m.scale,m.angle);
  ctx.font=`${8*s}px monospace`;ctx.fillStyle='#728269';ctx.fillText('A SMALL OBJECT. A NEW WORLD.',w*.07,h*.92);
  return {x:m.x/w,y:m.y/h};
}
export function demoMask(width,height,time) {
  const canvas=typeof OffscreenCanvas==='undefined'?document.createElement('canvas'):new OffscreenCanvas(width,height);canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true}),m=motion(width,height,time);rocket(ctx,m.x,m.y,m.scale,m.angle,true);
  const data=ctx.getImageData(0,0,width,height).data,mask=new Uint8Array(width*height);
  for(let i=0;i<mask.length;i++)mask[i]=data[i*4+3]>127?1:0;
  return mask;
}
