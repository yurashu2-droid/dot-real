import { bounds, warpMask } from './mask.js';

function grayImage(rgba, width, height) {
  const data = new Float32Array(width * height);
  for (let i = 0; i < data.length; i++) data[i] = rgba[i * 4] * 0.299 + rgba[i * 4 + 1] * 0.587 + rgba[i * 4 + 2] * 0.114;
  return { data, width, height };
}
function pyramid(image) {
  const levels = [image];
  for (let level = 1; level < 3; level++) {
    const old = levels[level - 1], width = Math.floor(old.width / 2), height = Math.floor(old.height / 2);
    const data = new Float32Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const p = y * 2 * old.width + x * 2;
      data[y * width + x] = (old.data[p] + old.data[p + 1] + old.data[p + old.width] + old.data[p + old.width + 1]) / 4;
    }
    levels.push({ data, width, height });
  }
  return levels;
}
function corners(image, mask, maxPoints) {
  const { data, width, height } = image, candidates = [];
  for (let y = 7; y < height - 7; y += 2) for (let x = 7; x < width - 7; x += 2) {
    if (!mask[y * width + x]) continue;
    let xx = 0, yy = 0, xy = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const i = (y + dy) * width + x + dx;
      const gx = data[i + 1] - data[i - 1], gy = data[i + width] - data[i - width];
      xx += gx * gx; yy += gy * gy; xy += gx * gy;
    }
    const score = (xx * yy - xy * xy) / (xx + yy + 1);
    if (score > 80) candidates.push({ x, y, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  const selected = [];
  for (const point of candidates) {
    if (selected.every(other => (point.x - other.x) ** 2 + (point.y - other.y) ** 2 > 49)) selected.push(point);
    if (selected.length >= maxPoints) break;
  }
  return selected;
}

/** Zero-mean normalized correlation is tolerant of modest exposure changes. */
function findPatch(from, to, point, guess, radius, search) {
  const x0 = Math.round(point.x), y0 = Math.round(point.y), size = (radius * 2 + 1) ** 2;
  if (x0 < radius || y0 < radius || x0 >= from.width - radius || y0 >= from.height - radius) return null;
  const patch = new Float32Array(size); let mean = 0, index = 0;
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const v = from.data[(y0 + dy) * from.width + x0 + dx]; patch[index++] = v; mean += v;
  }
  mean /= size; let energy = 0;
  for (let i = 0; i < size; i++) { patch[i] -= mean; energy += patch[i] ** 2; }
  if (energy < 100) return null;
  let best = null, bestScore = -1;
  const cx = Math.round(guess.x), cy = Math.round(guess.y);
  for (let y = Math.max(radius, cy - search); y <= Math.min(to.height - radius - 1, cy + search); y++) for (let x = Math.max(radius, cx - search); x <= Math.min(to.width - radius - 1, cx + search); x++) {
    let sum = 0, squares = 0, cross = 0, n = 0;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const value = to.data[(y + dy) * to.width + x + dx];
      sum += value; squares += value * value; cross += patch[n++] * value;
    }
    const variance = squares - sum * sum / size;
    const score = variance > 50 ? cross / Math.sqrt(energy * variance) : -1;
    if (score > bestScore) { bestScore = score; best = { x, y, score }; }
  }
  return best;
}
function matchPoint(previous, current, point) {
  let guess = { x: point.x / 4, y: point.y / 4 }, match = null;
  for (let level = 2; level >= 0; level--) {
    const scale = 2 ** level;
    match = findPatch(previous[level], current[level], { x: point.x / scale, y: point.y / scale }, guess, level ? 2 : 3, level === 2 ? 4 : 3);
    if (!match) return null;
    guess = { x: match.x * 2, y: match.y * 2 };
  }
  if (match.score < 0.64) return null;
  const back = findPatch(current[0], previous[0], match, point, 3, 3);
  if (!back || back.score < 0.64 || Math.hypot(back.x - point.x, back.y - point.y) > 1.6) return null;
  return { from: point, to: { x: match.x, y: match.y }, score: match.score };
}

function fit(pairs) {
  let px = 0, py = 0, qx = 0, qy = 0;
  for (const { from, to } of pairs) { px += from.x; py += from.y; qx += to.x; qy += to.y; }
  const n = pairs.length; px /= n; py /= n; qx /= n; qy /= n;
  let den = 0, real = 0, imaginary = 0;
  for (const { from, to } of pairs) {
    const x = from.x - px, y = from.y - py, u = to.x - qx, v = to.y - qy;
    den += x * x + y * y; real += x * u + y * v; imaginary += x * v - y * u;
  }
  if (den < 4) return null;
  const a = real / den, b = imaginary / den;
  return { a, b, tx: qx - a * px + b * py, ty: qy - b * px - a * py };
}

/** Deterministic two-point RANSAC, followed by a least-squares similarity fit. */
export function estimateSimilarity(pairs, threshold = 2.5) {
  if (pairs.length < 3) return null;
  let best = [];
  for (let i = 0; i < pairs.length; i++) for (let j = i + 1; j < pairs.length; j++) {
    const t = fit([pairs[i], pairs[j]]); if (!t) continue;
    const scale = Math.hypot(t.a, t.b);
    if (scale < 0.75 || scale > 1.33 || Math.abs(Math.atan2(t.b, t.a)) > 0.35) continue;
    const inliers = pairs.filter(({ from: p, to: q }) => Math.hypot(t.a * p.x - t.b * p.y + t.tx - q.x, t.b * p.x + t.a * p.y + t.ty - q.y) < threshold);
    if (inliers.length > best.length) best = inliers;
  }
  if (best.length < 3) return null;
  const t = fit(best); return t ? { ...t, inliers: best } : null;
}

/** This is short-term 2D tracking, not semantic object re-identification. */
export class PatchTracker {
  constructor({ maxPoints = 36 } = {}) { this.maxPoints = maxPoints; this.clear(); }
  clear() { this.previous = null; this.mask = null; this.points = []; this.frames = 0; }
  reset(rgba, width, height, mask) {
    this.width = width; this.height = height;
    this.previous = pyramid(grayImage(rgba, width, height));
    this.mask = new Uint8Array(mask); this.points = corners(this.previous[0], mask, this.maxPoints); this.frames = 0;
  }
  track(rgba) {
    if (!this.previous || this.points.length < 4) { this.clear(); return { lost: true, reason: '特徴のある場所を含めて、もう一度選んでください' }; }
    const current = pyramid(grayImage(rgba, this.width, this.height));
    const pairs = this.points.map(p => matchPoint(this.previous, current, p)).filter(Boolean);
    const transform = estimateSimilarity(pairs);
    if (!transform || transform.inliers.length < 4 || transform.inliers.length / this.points.length < 0.35) {
      this.clear(); return { lost: true, reason: '対象を見失いました。もう一度選んでください' };
    }
    const moved = warpMask(this.mask, this.width, this.height, transform), oldBox = bounds(this.mask, this.width, this.height), newBox = bounds(moved, this.width, this.height);
    if (!newBox || newBox.area < oldBox.area * 0.50) { this.clear(); return { lost: true, reason: '対象が画面から外れました' }; }
    const confidence = transform.inliers.reduce((sum, p) => sum + p.score, 0) / transform.inliers.length * Math.min(1, transform.inliers.length / (this.points.length * 0.75));
    this.previous = current; this.mask = moved; this.frames++;
    this.points = this.frames % 4 === 0 ? corners(current[0], moved, this.maxPoints) : transform.inliers.map(p => p.to);
    return { lost: false, mask: moved, transform, confidence, box: newBox };
  }
}
