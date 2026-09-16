import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

async function fixture() {
  const root=await mkdtemp(path.join(tmpdir(),'dot-real-vendor-'));
  await mkdir(path.join(root,'scripts'));await mkdir(path.join(root,'src/vision'),{recursive:true});
  await writeFile(path.join(root,'package.json'),'{"type":"module"}');
  await cp(new URL('../scripts/vendor.mjs',import.meta.url),path.join(root,'scripts/vendor.mjs'));
  await cp(new URL('../src/vision/assets.js',import.meta.url),path.join(root,'src/vision/assets.js'));
  return root;
}
const mockFetch=`globalThis.fetch=async url=>{const bytes=new Uint8Array(128);if(url.endsWith('.wasm'))bytes.set([0,97,115,109]);if(url.endsWith('.tflite'))bytes.set([84,70,76,51],4);return new Response(bytes);};`;
test('vendor publishes complete assets after staging without deleting its own staging folder',async()=>{
  const root=await fixture();
  try {
    const result=spawnSync(process.execPath,['--input-type=module','-e',mockFetch+`await import(${JSON.stringify(pathToFileURL(path.join(root,'scripts/vendor.mjs')).href)});`],{encoding:'utf8'});
    assert.equal(result.status,0,result.stdout+result.stderr);
    const manifest=JSON.parse(await readFile(path.join(root,'assets/vendor/manifest.json'),'utf8'));
    assert.equal(manifest.files.length,7);assert.equal(manifest.mediapipe,'0.10.21');
    assert.match(manifest.files[0].sha256,/^[a-f0-9]{64}$/);
  } finally {await rm(root,{recursive:true,force:true});}
});
test('failed asset preparation preserves the previously published assets',async()=>{
  const root=await fixture();
  try {
    await mkdir(path.join(root,'assets/vendor'),{recursive:true});await writeFile(path.join(root,'assets/vendor/marker'),'previous');
    const code=`globalThis.fetch=async()=>new Response('no',{status:503});await import(${JSON.stringify(pathToFileURL(path.join(root,'scripts/vendor.mjs')).href)});`;
    const result=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8'});
    assert.equal(result.status,1);assert.equal(await readFile(path.join(root,'assets/vendor/marker'),'utf8'),'previous');
  } finally {await rm(root,{recursive:true,force:true});}
});
