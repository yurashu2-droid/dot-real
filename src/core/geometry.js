/** All input points use normalized, unmirrored video coordinates. */
export function fitSize(width, height, maxSide = 480) {
  if (![width, height, maxSide].every(v => Number.isFinite(v) && v > 0)) throw new RangeError('Invalid image size');
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Account for object-fit: contain, including the actual letterbox area. */
export function mapPointer(clientX, clientY, rect, width, height) {
  if (!width || !height || !rect.width || !rect.height) return null;
  const scale = Math.min(rect.width / width, rect.height / height);
  const w = width * scale, h = height * scale;
  const x = (clientX - rect.left - (rect.width - w) / 2) / w;
  const y = (clientY - rect.top - (rect.height - h) / 2) / h;
  return x < 0 || y < 0 || x > 1 || y > 1 ? null : { x, y };
}

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
