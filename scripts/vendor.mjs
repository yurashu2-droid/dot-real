/** Download only pinned public runtime/model files, never camera data. */
import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CDN_ROOT, MODEL_URL, MEDIAPIPE_VERSION, MODEL_VERSION } from '../src/vision/assets.js';
const target = fileURLToPath(new URL('../assets/vendor', import.meta.url));
const staging = `${target}.staging`;
const files = [
  ['vision_bundle.mjs', `${CDN_ROOT}/vision_bundle.mjs`],
  ...['vision_wasm_internal.js','vision_wasm_internal.wasm','vision_wasm_nosimd_internal.js','vision_wasm_nosimd_internal.wasm'].map(name => [`wasm/${name}`, `${CDN_ROOT}/wasm/${name}`]),
  ['magic_touch.tflite', MODEL_URL],
  ['LICENSE.mediapipe', 'https://raw.githubusercontent.com/google-ai-edge/mediapipe/v0.10.21/LICENSE'],
];
try {
  await rm(staging, {recursive:true,force:true});await mkdir(`${staging}/wasm`,{recursive:true});
  const manifest = {mediapipe:MEDIAPIPE_VERSION,model:MODEL_VERSION,files:[]};
  for (const [name,url] of files) {
    console.log(`Downloading ${name}`);
    const response = await fetch(url,{signal:AbortSignal.timeout(180000)});
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 100) throw new Error(`${name}: empty or truncated response`);
    if (name.endsWith('.wasm') && bytes.subarray(0,4).toString('hex') !== '0061736d') throw new Error(`${name}: not a WASM binary`);
    if (name.endsWith('.tflite') && bytes.subarray(4,8).toString() !== 'TFL3') throw new Error(`${name}: not a TFLite model`);
    await writeFile(`${staging}/${name}`,bytes);
    manifest.files.push({name,url,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  await writeFile(`${staging}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
  // Publish only after every file passed the basic format checks. Hashes record provenance;
  // they are not an independently authenticated supply-chain signature.
  await rm(target,{recursive:true,force:true});await rename(staging,target);
  console.log('Ready: assets/vendor. Review THIRD_PARTY_NOTICES.md before redistributing.');
} catch (error) {
  await rm(staging,{recursive:true,force:true});console.error(`Asset preparation failed: ${error.message}`);process.exitCode=1;
}
