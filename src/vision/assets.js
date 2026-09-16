// Pin both JS and WASM to the same version: mismatching them breaks MediaPipe.
export const MEDIAPIPE_VERSION = '0.10.21';
export const MODEL_VERSION = 'magic_touch-float32-1';
export const CDN_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
export const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite';

export async function assetPaths() {
  const root = new URL('../../assets/vendor/', import.meta.url);
  try {
    const response = await fetch(new URL('manifest.json', root), { cache: 'no-cache' });
    if (response.ok) {
      const manifest = await response.json();
      if (manifest.mediapipe === MEDIAPIPE_VERSION && manifest.model === MODEL_VERSION) return { module: new URL('vision_bundle.mjs', root).href, wasm: new URL('wasm', root).href, model: new URL('magic_touch.tflite', root).href };
    }
  } catch { /* A static host without vendored assets uses pinned official assets. */ }
  return { module: `${CDN_ROOT}/vision_bundle.mjs`, wasm: `${CDN_ROOT}/wasm`, model: MODEL_URL };
}
