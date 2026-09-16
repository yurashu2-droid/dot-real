import test from 'node:test';
import assert from 'node:assert/strict';
import { fitSize, mapPointer } from '../src/core/geometry.js';
import { bounds, componentAt, rectangleMask, resizeMask, warpMask, maskIoU } from '../src/core/mask.js';
import { pixelate, PALETTES } from '../src/core/pixel.js';
import { estimateSimilarity, PatchTracker } from '../src/core/tracker.js';

test('fit size retains aspect and rejects invalid dimensions', () => {
  assert.deepEqual(fitSize(1920,1080,480), {width:480,height:270});
  assert.deepEqual(fitSize(100,200,480), {width:100,height:200});
  assert.throws(() => fitSize(0,20), RangeError);
});
test('pointer maps into contained landscape video and rejects letterboxes', () => {
  const r={left:10,top:20,width:100,height:100};
  assert.deepEqual(mapPointer(60,70,r,200,100), {x:0.5,y:0.5});
  assert.equal(mapPointer(60,22,r,200,100), null);
  assert.equal(mapPointer(111,70,r,200,100), null);
});
test('pointer works with portrait source in landscape area', () => {
  const r={left:0,top:0,width:200,height:100};
  assert.deepEqual(mapPointer(100,50,r,100,200),{x:0.5,y:0.5});
  assert.equal(mapPointer(10,50,r,100,200),null);
});
test('rectangle clamps and accepts either drag direction', () => {
  const m=rectangleMask(10,10,{x:0.8,y:0.9},{x:0.2,y:0.3});
  assert.deepEqual(bounds(m,10,10),{x:2,y:3,width:6,height:6,area:36});
});
test('component selects only the foreground connected to tap', () => {
  const m=Uint8Array.from([1,1,0,0,1, 1,1,0,0,1, 0,0,0,0,1]);
  const out=componentAt(m,5,3,{x:0.1,y:0.1});
  assert.equal(out.reduce((a,b)=>a+b,0),4);
  assert.equal(out[4],0);
});
test('mask bounds and resize support empty and non-square images', () => {
  assert.equal(bounds(new Uint8Array(16),4,4),null);
  assert.deepEqual([...resizeMask(Uint8Array.of(1,0),2,1,4,2)],[1,1,0,0,1,1,0,0]);
});
test('mask warp moves shape with the object and drops offscreen pixels', () => {
  const m=rectangleMask(10,10,{x:0.2,y:0.2},{x:0.5,y:0.5});
  const moved=warpMask(m,10,10,{a:1,b:0,tx:3,ty:1});
  assert.deepEqual(bounds(moved,10,10),{x:5,y:3,width:3,height:3,area:9});
  assert.equal(bounds(warpMask(m,10,10,{a:1,b:0,tx:20,ty:0}),10,10),null);
  assert.equal(maskIoU(m,m),1);
  assert.equal(maskIoU(m,moved),0);
});
test('pixelation changes selected blocks but preserves untouched background', () => {
  const src=new Uint8ClampedArray(4*4*4);
  for(let i=0;i<16;i++) src.set([100+i,80,160,255],i*4);
  const mask=rectangleMask(4,4,{x:0,y:0},{x:0.5,y:0.5});
  const out=pixelate(src,4,4,mask,{blockSize:2,palette:'gameboy',outline:false});
  assert.notDeepEqual([...out.slice(0,4)],[...src.slice(0,4)]);
  assert.deepEqual([...out.slice(0,4)],[...out.slice(4,8)]);
  assert.deepEqual([...out.slice(12,16)],[...src.slice(12,16)]);
  assert.deepEqual([...out.slice(0,3)], PALETTES.gameboy.colors.find(c=>c.every((v,j)=>v===out[j])));
  assert.equal(src[0],100);
});
test('pixel color ignores background pixels within a selected edge block', () => {
  const src=Uint8ClampedArray.from([255,0,0,255,0,0,255,255,0,0,255,255,0,0,255,255]);
  const out=pixelate(src,2,2,Uint8Array.of(1,0,0,0),{blockSize:2,palette:'color',outline:false});
  assert.deepEqual([...out.slice(0,3)],[255,0,0]);
});
test('invalid mask lengths are rejected rather than silently pixelating everything', () => {
  assert.throws(()=>pixelate(new Uint8ClampedArray(16),2,2,new Uint8Array(2),{blockSize:2,palette:'color'}),RangeError);
});
test('similarity estimation rejects a gross mismatched feature', () => {
  const pairs=[[0,0],[30,0],[0,30],[30,30],[15,15]].map(([x,y])=>({from:{x,y},to:{x:x+4,y:y-2},score:1}));
  pairs.push({from:{x:10,y:20},to:{x:80,y:80},score:0.7});
  const t=estimateSimilarity(pairs);
  assert.ok(t);
  assert.ok(Math.abs(t.tx-4)<0.001);
  assert.ok(Math.abs(t.ty+2)<0.001);
  assert.ok(t.inliers.length===5);
});
test('similarity estimation captures rotation and scale', () => {
  const a=1.06*Math.cos(0.09),b=1.06*Math.sin(0.09);
  const pairs=[[10,10],[40,10],[10,40],[40,40]].map(([x,y])=>({from:{x,y},to:{x:a*x-b*y+3,y:b*x+a*y+1},score:1}));
  const t=estimateSimilarity(pairs); assert.ok(t);
  assert.ok(Math.abs(t.a-a)<1e-6);assert.ok(Math.abs(t.b-b)<1e-6);
});
export function texturedFrame(dx=0,dy=0){
  const width=160,height=120,rgba=new Uint8ClampedArray(width*height*4);
  let random=91234; const texture=new Uint8Array(60*60);
  for(let i=0;i<texture.length;i++){random=(Math.imul(random,1664525)+1013904223)>>>0;texture[i]=40+(random%190);}
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const px=x-45-dx,py=y-30-dy;const v=px>=0&&px<60&&py>=0&&py<60?texture[py*60+px]:16;
    rgba.set([v,v,v,255],(y*width+x)*4);
  }
  return {width,height,rgba,mask:rectangleMask(width,height,{x:(45+dx)/width,y:(30+dy)/height},{x:(105+dx)/width,y:(90+dy)/height})};
}
test('real patch tracker follows translated pixels, not an animation timer', () => {
  const f=texturedFrame(),next=texturedFrame(4,-3);const tracker=new PatchTracker();
  tracker.reset(f.rgba,f.width,f.height,f.mask);
  const out=tracker.track(next.rgba);assert.equal(out.lost,false);
  assert.ok(Math.abs(out.transform.tx-4)<1,JSON.stringify(out.transform));
  assert.ok(Math.abs(out.transform.ty+3)<1,JSON.stringify(out.transform));
  assert.ok(maskIoU(out.mask,next.mask)>0.88);
});
test('tracker declares loss on fully occluded object', () => {
  const f=texturedFrame();const tracker=new PatchTracker();tracker.reset(f.rgba,f.width,f.height,f.mask);
  const flat=new Uint8ClampedArray(f.rgba.length).fill(128);
  assert.equal(tracker.track(flat).lost,true);
});
