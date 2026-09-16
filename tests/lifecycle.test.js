import test from 'node:test';
import assert from 'node:assert/strict';
import { CameraController, cameraError } from '../src/camera.js';
import { categoryResultToMask } from '../src/vision/segmenter.js';
import { FrameProcessor } from '../src/vision/pipeline.js';

const fakeVideo=()=>({srcObject:null,play:async()=>{},pause:()=>{}});
test('camera rejects insecure contexts before asking for permission',async()=>{
  let called=false;const camera=new CameraController(fakeVideo(),{getUserMedia:async()=>{called=true;}},false);
  await assert.rejects(camera.start(),/HTTPS/);assert.equal(called,false);
});
test('stop closes a permission acquisition that resolves late',async()=>{
  let resolve,closed=0;const pending=new Promise(r=>{resolve=r;});const video=fakeVideo();
  const camera=new CameraController(video,{getUserMedia:()=>pending},true);
  const start=camera.start();camera.stop();resolve({getTracks:()=>[{stop:()=>closed++}]});
  assert.equal(await start,null);assert.equal(closed,1);assert.equal(video.srcObject,null);
});
test('stop closes every media track and clears the video',async()=>{
  let closed=0;const video=fakeVideo();const camera=new CameraController(video,{getUserMedia:async()=>({getTracks:()=>[{stop:()=>closed++},{stop:()=>closed++}]})},true);
  await camera.start('environment');camera.stop();assert.equal(closed,2);assert.equal(video.srcObject,null);
});
test('failed video playback releases acquired tracks',async()=>{
  let closed=0;const video={...fakeVideo(),play:async()=>{throw new Error('play failed');}};
  const camera=new CameraController(video,{getUserMedia:async()=>({getTracks:()=>[{stop:()=>closed++}]})},true);
  await assert.rejects(camera.start(),/play failed/);assert.equal(closed,1);
});
test('permission errors have actionable Japanese text',()=>{
  assert.match(cameraError({name:'NotAllowedError'}),/許可/);
  assert.match(cameraError({name:'NotFoundError'}),/見つかり/);
});
test('mask adapter copies callback-owned data and selects the tap component',()=>{
  const data=Uint8Array.of(0,0,0,0,0,0,1,1,0,0,0,1,1,0,0,0,0,0,0,0);
  const result={categoryMask:{width:5,height:4,getAsUint8Array:()=>data}};
  const out=categoryResultToMask(result,{x:.3,y:.4},5,4);data.fill(0);
  assert.equal(out.reduce((a,b)=>a+b,0),4);assert.equal(out[6],1);
});
test('mask adapter supports foreground class zero without inverting the object',()=>{
  const data=Uint8Array.of(1,1,1,1,0,1,1,1,1);
  const out=categoryResultToMask({categoryMask:{width:3,height:3,getAsUint8Array:()=>data}},{x:.5,y:.5},3,3);
  assert.equal(out.reduce((a,b)=>a+b,0),1);
});
test('empty AI output does not silently become whole-frame pixelation',()=>{
  assert.throws(()=>categoryResultToMask({}, {x:.5,y:.5},20,20),/mask/i);
});
test('pipeline does not retain a selected mask after clear',()=>{
  const processor=new FrameProcessor({segment:()=>{throw new Error('not needed');}});
  const rgba=new Uint8ClampedArray(40*40*4).fill(128);
  processor.process({rgba,width:40,height:40},{selection:{kind:'manual',from:{x:.2,y:.2},to:{x:.7,y:.7}},style:{outline:false}});
  processor.clear();const result=processor.process({rgba,width:40,height:40},{style:{}});
  assert.equal(result.state,'idle');assert.equal(result.box,null);
});
