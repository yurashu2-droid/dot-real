import { bounds } from './mask.js';

export const PALETTES = Object.freeze({
  color: { name: 'COLOR', description: '64 colors', colors: null },
  gameboy: { name: 'POCKET', description: '4 colors', colors: [[15,56,15],[48,98,48],[139,172,15],[155,188,15]] },
  mono: { name: 'MONO', description: '4 colors', colors: [[24,25,27],[83,88,99],[161,169,176],[240,243,232]] },
  candy: { name: 'CANDY', description: '16 colors', colors: [[32,25,48],[76,38,86],[134,46,106],[214,70,132],[255,132,162],[255,212,183],[249,241,211],[236,168,84],[166,98,48],[78,81,48],[125,177,98],[193,224,115],[67,105,143],[86,166,192],[135,222,223],[159,127,190]] },
});

export function paletteColor(r, g, b, palette) {
  const colors = PALETTES[palette]?.colors;
  if (!colors) return [r, g, b].map(v => Math.round(v / 85) * 85);
  let best = colors[0], distance = Infinity;
  for (const c of colors) {
    const d = 0.30 * (r - c[0]) ** 2 + 0.59 * (g - c[1]) ** 2 + 0.11 * (b - c[2]) ** 2;
    if (d < distance) { distance = d; best = c; }
  }
  return best;
}

/** Fixed palettes + a target-anchored grid reduce temporal color/grid flicker. */
export function pixelate(rgba, width, height, mask, { blockSize = 10, palette = 'color', outline = true } = {}) {
  if (rgba.length !== width * height * 4 || mask.length !== width * height) throw new RangeError('Image/mask dimensions differ');
  const out = new Uint8ClampedArray(rgba), box = bounds(mask, width, height);
  if (!box) return out;
  const block = Math.max(2, Math.min(40, Math.round(blockSize)));
  const alpha = outline ? new Uint8Array(mask.length) : null;
  for (let by = box.y; by < box.y + box.height; by += block) for (let bx = box.x; bx < box.x + box.width; bx += block) {
    const x1 = Math.min(width, bx + block), y1 = Math.min(height, by + block);
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = by; y < y1; y++) for (let x = bx; x < x1; x++) {
      const p = y * width + x;
      if (mask[p]) { r += rgba[p * 4]; g += rgba[p * 4 + 1]; b += rgba[p * 4 + 2]; n++; }
    }
    if (!n) continue;
    // Ignore background colors at the silhouette, then render a whole crisp cell.
    const c = paletteColor(r / n, g / n, b / n, palette);
    for (let y = by; y < y1; y++) for (let x = bx; x < x1; x++) {
      const p = y * width + x, i = p * 4;
      out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2];
      if (alpha) alpha[p] = 1;
    }
  }
  if (alpha) for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const p = y * width + x;
    if (!alpha[p] && (alpha[p - 1] || alpha[p + 1] || alpha[p - width] || alpha[p + width])) {
      out[p * 4] = 20; out[p * 4 + 1] = 25; out[p * 4 + 2] = 23;
    }
  }
  return out;
}
