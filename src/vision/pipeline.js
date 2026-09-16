import { rectangleMask, validMask, bounds, maskIoU, interiorPoint } from '../core/mask.js';
import { pixelate } from '../core/pixel.js';
import { PatchTracker } from '../core/tracker.js';

/** An inference-independent frame pipeline; the segmenter is a small adapter. */
export class FrameProcessor {
  constructor(segmenter) { this.segmenter = segmenter; this.tracker = new PatchTracker(); this.clear(); }
  clear() { this.mask = null; this.kind = null; this.tracker.clear(); this.refreshFailures = 0; this.width = 0; this.height = 0; }
  process(frame, { selection, style = {}, now = performance.now() } = {}) {
    const { rgba, width, height, source } = frame;
    let state = 'idle', confidence = 0;
    if (this.mask && (this.width !== width || this.height !== height)) {
      this.clear(); return { rgba, state: 'lost', box: null, message: '画面の向きが変わりました。もう一度選んでください。' };
    }
    if (selection) {
      this.clear(); let mask;
      if (selection.kind === 'manual') mask = rectangleMask(width, height, selection.from, selection.to);
      else if (selection.kind === 'demo') mask = new Uint8Array(selection.mask);
      else if (selection.kind === 'ai') mask = this.segmenter.segment(source, selection.point, width, height);
      else throw new Error('Unknown selection mode');
      if (mask.length !== width * height || !validMask(mask, width, height)) throw new Error('対象を選べませんでした。物体の中央、または少し広い範囲を選んでください。');
      this.mask = mask; this.kind = selection.kind; this.width = width; this.height = height;
      this.tracker.reset(rgba, width, height, mask); this.lastSegment = now; this.refreshInterval = 1000;
      state = 'selected'; confidence = 1;
    } else if (this.mask) {
      const tracked = this.tracker.track(rgba);
      if (tracked.lost) { this.clear(); return { rgba, state: 'lost', box: null, message: tracked.reason }; }
      this.mask = tracked.mask; confidence = tracked.confidence; state = 'tracking';
      if (this.kind === 'ai' && now - this.lastSegment >= this.refreshInterval) {
        const point = interiorPoint(this.mask, width, height), start = performance.now();
        try {
          const fresh = this.segmenter.segment(source, point, width, height);
          const old = bounds(this.mask, width, height), box = validMask(fresh, width, height);
          if (!box || maskIoU(this.mask, fresh) < 0.25 || box.area > old.area * 2.2 || box.area < old.area * 0.4) throw new Error('Mask changed too much');
          this.mask = fresh; this.tracker.reset(rgba, width, height, fresh); this.refreshFailures = 0;
        } catch {
          this.refreshFailures++;
          if (this.refreshFailures >= 2) { this.clear(); return { rgba, state: 'lost', box: null, message: '輪郭を確認できなくなりました。もう一度選んでください。' }; }
        }
        this.lastSegment = now;
        this.refreshInterval = Math.min(4000, Math.max(1000, (performance.now() - start) * 5));
      }
    }
    return { rgba: this.mask ? pixelate(rgba, width, height, this.mask, style) : rgba, state, confidence, box: this.mask ? bounds(this.mask, width, height) : null };
  }
}
