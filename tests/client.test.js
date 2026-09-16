import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { VisionClient } from '../src/vision/client.js';
const original = globalThis.Worker;
const clients = [];
class WorkerStub {
  messages = []; terminated = false;
  postMessage(message) { this.messages.push(message); }
  terminate() { this.terminated = true; }
  emit(data) { this.onmessage({data}); }
}
function setup() {
  globalThis.Worker = WorkerStub;
  const frames = [], errors = [], models = [];
  const client = new VisionClient({onReady(){},onFrame:d=>frames.push(d),onModel:d=>models.push(d),onError:e=>errors.push(e)});
  clients.push(client); client.worker.emit({type:'ready'});
  return {client,frames,errors,models};
}
function bitmap() { return {closed:false,close(){this.closed=true;}}; }
afterEach(()=>{clients.splice(0).forEach(c=>c.close());globalThis.Worker=original;});
test('client allows only one in-flight frame and disposes rejected bitmap',()=>{
  const {client}=setup(), first=bitmap(), second=bitmap();
  assert.equal(client.send(first,null,{},()=>{}),true);
  assert.equal(client.send(second,null,{},()=>{}),false); assert.equal(second.closed,true);
  assert.equal(client.worker.messages.filter(m=>m.type==='frame').length,1);
});
test('clear rejects stale worker result and closes both image resources',()=>{
  const {client,frames}=setup();client.send(bitmap(),null,{},()=>{});
  const id=client.worker.messages.at(-1).id;client.clear();
  const image=bitmap(),original=bitmap();client.worker.emit({type:'result',id,bitmap:image,original});
  assert.equal(frames.length,0);assert.equal(image.closed,true);assert.equal(original.closed,true);assert.equal(client.busy,false);
});
test('current frame result is delivered after a new selection',()=>{
  const {client,frames}=setup();client.clear();client.send(bitmap(),null,{},()=>{});
  const id=client.worker.messages.at(-1).id;client.worker.emit({type:'result',id,bitmap:bitmap(),original:bitmap()});
  assert.equal(frames.length,1);assert.equal(client.busy,false);
});
test('closing terminates worker and safely disposes late results',()=>{
  const {client,frames}=setup();client.close();const image=bitmap(),original=bitmap();
  client.worker.emit({type:'result',bitmap:image,original});
  assert.equal(client.worker.terminated,true);assert.equal(image.closed,true);assert.equal(original.closed,true);assert.equal(frames.length,0);
});
