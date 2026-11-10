// Geometry helpers. Pure. Rect = {x, y, w, h}.
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const pointInRect = (px, py, r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
export const rectsOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// Liang-Barsky: parameter t in [0,1] where segment (x1,y1)-(x2,y2) first touches rect r, or -1 if it misses.
// t = 0 when the segment starts inside the rect.
export function segmentAABBEntry(x1, y1, x2, y2, r) {
  const dx = x2 - x1, dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return -1;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return -1; if (t > t0) t0 = t; }
      else { if (t < t0) return -1; if (t < t1) t1 = t; }
    }
  }
  return t0;
}

// Does segment (x1,y1)-(x2,y2) touch rect r?
export const segmentIntersectsAABB = (x1, y1, x2, y2, r) => segmentAABBEntry(x1, y1, x2, y2, r) >= 0;

export function normalizeAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}
export const angleDiff = (a, b) => normalizeAngle(a - b);

// Is point (px,py) inside the cone at (ox,oy) facing `dir` radians, total width `fov`, reach `range`?
export function pointInCone(ox, oy, dir, fov, range, px, py) {
  const d = dist(ox, oy, px, py);
  if (d > range) return false;
  if (d === 0) return true;
  return Math.abs(angleDiff(Math.atan2(py - oy, px - ox), dir)) <= fov / 2;
}

// Move a square (centre pos, half-size) by dx,dy, axis by axis, blocked by rects and bounds {w,h}.
export function moveWithCollision(pos, dx, dy, half, rects, bounds) {
  const hits = (x, y) => {
    const box = { x: x - half, y: y - half, w: half * 2, h: half * 2 };
    for (const r of rects) if (rectsOverlap(box, r)) return true;
    return false;
  };
  let nx = clamp(pos.x + dx, half, bounds.w - half);
  if (hits(nx, pos.y)) nx = pos.x;
  let ny = clamp(pos.y + dy, half, bounds.h - half);
  if (hits(nx, ny)) ny = pos.y;
  pos.x = nx;
  pos.y = ny;
  return pos;
}
