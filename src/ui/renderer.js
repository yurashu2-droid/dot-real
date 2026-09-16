export class PreviewRenderer {
  constructor(canvas, overlay) { this.canvas=canvas;this.overlay=overlay;this.context=canvas.getContext('2d',{willReadFrequently:true});this.overlayContext=overlay.getContext('2d');this.clear(); }
  clear() { this.bitmap?.close();this.original?.close();this.bitmap=null;this.original=null;this.box=null;this.compare=false;this.overlayContext?.clearRect(0,0,this.overlay.width,this.overlay.height); }
  resize(width,height) { if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;this.overlay.width=width;this.overlay.height=height;} }
  live(source) { const width=source.videoWidth||source.width,height=source.videoHeight||source.height;if(!width||!height)return;this.resize(width,height);this.context.drawImage(source,0,0,width,height);this.overlayContext.clearRect(0,0,width,height); }
  frame(bitmap,original,box) { this.bitmap?.close();this.original?.close();this.bitmap=bitmap;this.original=original;this.box=box;this.draw(); }
  draw() { const bitmap=this.compare?this.original:this.bitmap;if(!bitmap)return;this.resize(bitmap.width,bitmap.height);this.context.drawImage(bitmap,0,0);this.overlayContext.clearRect(0,0,this.overlay.width,this.overlay.height);if(this.box)this.corners(this.box); }
  corners(box) {
    const ctx=this.overlayContext,p=6,x=Math.max(2,box.x-p),y=Math.max(2,box.y-p),w=box.width+2*p,h=box.height+2*p,l=12;
    ctx.strokeStyle='#dafc8d';ctx.lineWidth=1.3;ctx.beginPath();
    for(const [px,py,sx,sy] of [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]]){ctx.moveTo(px+sx*l,py);ctx.lineTo(px,py);ctx.lineTo(px,py+sy*l);}ctx.stroke();
  }
  rectangle(from,to) { const ctx=this.overlayContext,w=this.canvas.width,h=this.canvas.height;ctx.clearRect(0,0,w,h);ctx.strokeStyle='#dafc8d';ctx.fillStyle='#dafc8d19';ctx.lineWidth=2;ctx.setLineDash([5,4]);const x=Math.min(from.x,to.x)*w,y=Math.min(from.y,to.y)*h,bw=Math.abs(to.x-from.x)*w,bh=Math.abs(to.y-from.y)*h;ctx.fillRect(x,y,bw,bh);ctx.strokeRect(x,y,bw,bh);ctx.setLineDash([]); }
  setComparison(value) { this.compare=value;this.draw(); }
  blob() { return new Promise((resolve,reject)=>this.canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('画像を保存できませんでした')),'image/png')); }
}
