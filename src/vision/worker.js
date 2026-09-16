// A classic worker deliberately: MediaPipe 0.10.21's WASM loader uses importScripts.
// App code is loaded with dynamic import, which is legal in a classic dedicated worker.
const ready = Promise.all([import('./segmenter.js'), import('./pipeline.js')]).then(([{ TapSegmenter }, { FrameProcessor }]) => {
  const segmenter = new TapSegmenter();
  return { segmenter, processor: new FrameProcessor(segmenter) };
});
let input, inputContext, output, outputContext;
ready.then(() => self.postMessage({ type: 'ready' })).catch(error => self.postMessage({ type: 'fatal', message: String(error.message || error) }));

self.onmessage = async ({ data }) => {
  const { segmenter, processor } = await ready;
  if (data.type === 'load-ai') {
    try {
      await segmenter.load(detail => self.postMessage({ type: 'model', state: 'loading', detail }));
      self.postMessage({ type: 'model', state: 'ready', detail: 'AI READY' });
    } catch (error) { self.postMessage({ type: 'model', state: 'error', detail: String(error.message || error) }); }
    return;
  }
  if (data.type === 'clear') { processor.clear(); return; }
  if (data.type !== 'frame') return;
  const { bitmap, selection, style, id } = data;
  let transferred = false;
  try {
    const width = bitmap.width, height = bitmap.height;
    if (!input || input.width !== width || input.height !== height) {
      input = new OffscreenCanvas(width, height); inputContext = input.getContext('2d', { willReadFrequently: true });
      output = new OffscreenCanvas(width, height); outputContext = output.getContext('2d');
      if (!inputContext || !outputContext) throw new Error('Canvas 2D is unavailable');
    }
    const start = performance.now(); inputContext.drawImage(bitmap, 0, 0);
    const image = inputContext.getImageData(0, 0, width, height);
    let result;
    try { result = processor.process({ rgba: image.data, width, height, source: input }, { selection, style }); }
    catch (error) { processor.clear(); result = { rgba: image.data, state: 'lost', box: null, message: String(error.message || error) }; }
    outputContext.putImageData(new ImageData(result.rgba, width, height), 0, 0);
    const rendered = output.transferToImageBitmap();
    self.postMessage({ type: 'result', id, bitmap: rendered, original: bitmap, state: result.state, box: result.box, confidence: result.confidence, message: result.message, milliseconds: performance.now() - start }, [rendered, bitmap]);
    transferred = true;
  } catch (error) { self.postMessage({ type: 'frame-error', id, message: String(error.message || error) }); }
  finally { if (!transferred) bitmap.close(); }
};
