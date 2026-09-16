import { clamp } from './geometry.js';

export function bounds(mask, width, height) {
  let minX = width, minY = height, maxX = -1, maxY = -1, area = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) {
    const x = i % width, y = Math.floor(i / width);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y); area++;
  }
  return area ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, area } : null;
}

export function rectangleMask(width, height, from, to) {
  const mask = new Uint8Array(width * height);
  const x0 = clamp(Math.floor(Math.min(from.x, to.x) * width), 0, width);
  const x1 = clamp(Math.ceil(Math.max(from.x, to.x) * width), 0, width);
  const y0 = clamp(Math.floor(Math.min(from.y, to.y) * height), 0, height);
  const y1 = clamp(Math.ceil(Math.max(from.y, to.y) * height), 0, height);
  for (let y = y0; y < y1; y++) mask.fill(1, y * width + x0, y * width + x1);
  return mask;
}

export function resizeMask(mask, oldWidth, oldHeight, width, height) {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    out[y * width + x] = mask[Math.min(oldHeight - 1, Math.floor(y * oldHeight / height)) * oldWidth + Math.min(oldWidth - 1, Math.floor(x * oldWidth / width))] ? 1 : 0;
  }
  return out;
}

/** Keep only the connected foreground object at (or just beside) the prompt. */
export function componentAt(mask, width, height, point) {
  const out = new Uint8Array(width * height);
  const px = clamp(Math.floor(point.x * width), 0, width - 1), py = clamp(Math.floor(point.y * height), 0, height - 1);
  let seed = py * width + px;
  if (!mask[seed]) {
    let distance = Infinity; seed = -1;
    for (let y = Math.max(0, py - 5); y <= Math.min(height - 1, py + 5); y++) for (let x = Math.max(0, px - 5); x <= Math.min(width - 1, px + 5); x++) {
      const d = (x - px) ** 2 + (y - py) ** 2;
      if (mask[y * width + x] && d < distance) { distance = d; seed = y * width + x; }
    }
  }
  if (seed < 0) return out;
  const queue = new Int32Array(width * height); let head = 0, tail = 1;
  queue[0] = seed; out[seed] = 1;
  while (head < tail) {
    const i = queue[head++], x = i % width;
    const visit = j => { if (mask[j] && !out[j]) { out[j] = 1; queue[tail++] = j; } };
    if (x > 0) visit(i - 1); if (x < width - 1) visit(i + 1);
    if (i >= width) visit(i - width); if (i < width * (height - 1)) visit(i + width);
  }
  return out;
}

export function warpMask(mask, width, height, { a, b, tx, ty }) {
  const out = new Uint8Array(mask.length), det = a * a + b * b;
  if (det < 1e-6) return out;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const dx = x - tx, dy = y - ty;
    const sx = Math.round((a * dx + b * dy) / det), sy = Math.round((-b * dx + a * dy) / det);
    if (sx >= 0 && sy >= 0 && sx < width && sy < height) out[y * width + x] = mask[sy * width + sx];
  }
  return out;
}

export function maskIoU(a, b) {
  let intersection = 0, union = 0;
  for (let i = 0; i < a.length; i++) { if (a[i] && b[i]) intersection++; if (a[i] || b[i]) union++; }
  return union ? intersection / union : 0;
}

/** A point well inside the object is less likely to jump to the background. */
export function interiorPoint(mask, width, height) {
  const d = new Uint16Array(mask.length); let best = -1, score = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (mask[i]) d[i] = 1 + Math.min(x ? d[i - 1] : 0, y ? d[i - width] : 0);
  }
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
    const i = y * width + x;
    if (mask[i]) {
      d[i] = Math.min(d[i], 1 + Math.min(x < width - 1 ? d[i + 1] : 0, y < height - 1 ? d[i + width] : 0));
      if (d[i] > score) { best = i; score = d[i]; }
    }
  }
  return best < 0 ? null : { x: ((best % width) + 0.5) / width, y: (Math.floor(best / width) + 0.5) / height };
}

export function validMask(mask, width, height) {
  const box = bounds(mask, width, height);
  return box && box.area >= Math.max(16, width * height * 0.001) && box.area < width * height * 0.88 ? box : null;
}
