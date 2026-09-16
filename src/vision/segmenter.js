import { componentAt, resizeMask } from '../core/mask.js';
import { clamp } from '../core/geometry.js';
import { assetPaths } from './assets.js';

/** Must be called while MediaPipe's callback-owned mask is still alive. */
export function categoryResultToMask(result, point, width, height) {
  const mask = result.categoryMask;
  if (!mask) throw new Error('No category mask returned by the model');
  const bytes = mask.getAsUint8Array();
  const x = clamp(Math.floor(point.x * mask.width), 0, mask.width - 1), y = clamp(Math.floor(point.y * mask.height), 0, mask.height - 1);
  const foreground = bytes[y * mask.width + x];
  const binary = Uint8Array.from(bytes, v => v === foreground ? 1 : 0);
  const component = componentAt(binary, mask.width, mask.height, point);
  return resizeMask(component, mask.width, mask.height, width, height);
}

async function modelBytes(url, onProgress) {
  const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 45000);
  try {
    const response = await fetch(url, { signal: abort.signal });
    if (!response.ok) throw new Error(`Model download failed (${response.status})`);
    if (!response.body) return new Uint8Array(await response.arrayBuffer());
    const reader = response.body.getReader(), chunks = []; let size = 0;
    const total = Number(response.headers.get('content-length'));
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length; chunks.push(value);
      onProgress(total ? `モデル読込 ${Math.min(100, Math.round(size / total * 100))}%` : `モデル読込 ${(size / 1048576).toFixed(1)} MB`);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return bytes;
  } finally { clearTimeout(timeout); }
}

export class TapSegmenter {
  constructor() { this.task = null; this.loading = null; }
  async load(onProgress = () => {}) {
    if (this.task) return;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const paths = await assetPaths(); onProgress('AIエンジンを読み込んでいます');
      const { FilesetResolver, InteractiveSegmenter } = await import(paths.module);
      const [files, bytes] = await Promise.all([FilesetResolver.forVisionTasks(paths.wasm), modelBytes(paths.model, onProgress)]);
      onProgress('AIモデルを起動しています');
      this.task = await InteractiveSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetBuffer: bytes, delegate: 'CPU' },
        outputCategoryMask: true, outputConfidenceMasks: false,
      });
    })();
    try { await this.loading; } finally { this.loading = null; }
  }
  segment(source, point, width, height) {
    if (!this.task) throw new Error('AIの準備が終わっていません。枠で選択することもできます。');
    let output;
    this.task.segment(source, { keypoint: point }, result => { output = categoryResultToMask(result, point, width, height); });
    if (!output) throw new Error('対象を切り抜けませんでした。物体の中央を選んでください。');
    return output;
  }
  close() { this.task?.close(); this.task = null; }
}
