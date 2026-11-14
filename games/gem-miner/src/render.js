// Canvas 2D renderer (browser only). The world is pre-rendered in 16x16-tile chunks into plain offscreen <canvas>
// elements (not OffscreenCanvas, for older iOS), only visible chunks are drawn, and everything is placed at integer
// device pixels so there are no seams. Fog is a separate cheap per-frame layer on top.
import { T, isGem, gemIndex } from './tiles.js';
import { hash2 } from './rng.js';
import { GEMS } from './economy.js';

const CH = 16;                 // chunk size in tiles
// Cached chunk pixels: 16 M px is 64 MB of RGBA. The old 70 M px (280 MB) budget could exceed iOS Safari's canvas
// memory limit on a phone; we still always keep the visible chunks plus a margin (D26).
const PIXEL_BUDGET = 16e6;
const BASE = {
  [T.DIRT]: [122, 82, 51], [T.STONE]: [112, 115, 120], [T.GRANITE]: [140, 104, 100], [T.OBSIDIAN]: [44, 36, 62],
  [T.CRYSTAL]: [110, 224, 240], [T.BEDROCK]: [26, 26, 32], [T.AIR]: [58, 44, 34], [T.TOWN]: [168, 140, 95],
  [T.SHOP]: [168, 140, 95], [T.FLOOR]: [74, 61, 88], [T.CHEST]: [58, 44, 34], [T.DREAM]: [74, 61, 88],
};
const RING_BASE = [BASE[T.DIRT], BASE[T.STONE], BASE[T.GRANITE], BASE[T.OBSIDIAN]];
const rgb = (c, d = 0) => `rgb(${Math.max(0, Math.min(255, c[0] + d))},${Math.max(0, Math.min(255, c[1] + d))},${Math.max(0, Math.min(255, c[2] + d))})`;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let dpr = 1, W = 0, H = 0, ts = 32, tsD = 0, chunks = new Map(), frame = 0, maxChunks = 30;
  const view = { w: 10, h: 10 };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = window.innerWidth, vh = window.innerHeight;
    ts = Math.max(26, Math.min(40, Math.round(Math.min(vw, vh) / 20)));
    const tsNew = Math.max(8, Math.round(ts * dpr));
    // Keep the chunk cache when only the viewport changed (mobile URL bar, rotation with the same tile size).
    if (tsNew !== tsD) chunks.clear();
    tsD = tsNew;
    W = Math.max(1, Math.round(vw * dpr)); H = Math.max(1, Math.round(vh * dpr));
    canvas.width = W; canvas.height = H;
    canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
    const side = CH * tsD, visible = (Math.ceil(W / side) + 1) * (Math.ceil(H / side) + 1);
    maxChunks = Math.max(visible + 6, Math.floor(PIXEL_BUDGET / (side * side)));
    view.w = W / tsD; view.h = H / tsD;
    return view;
  }

  function drawTileAt(c, world, x, y, px, py, s) {
    const i = y * world.size + x, t = world.tiles[i];
    let base = BASE[t];
    if (isGem(t)) base = RING_BASE[world.ring[i]];
    if (!base) base = BASE[T.AIR];
    const h0 = hash2(x, y, 7), shade = Math.round((h0 - 0.5) * 16);
    c.fillStyle = rgb(base, shade);
    c.fillRect(px, py, s, s);
    const rock = (t >= T.DIRT && t <= T.CRYSTAL) || isGem(t);
    // speckles
    const n = Math.max(1, s >> 4);
    for (let k = 0; k < 3; k++) {
      const sx = Math.floor(hash2(x, y, 20 + k) * (s - n)), sy = Math.floor(hash2(x, y, 40 + k) * (s - n));
      c.fillStyle = rgb(base, hash2(x, y, 60 + k) < 0.5 ? -26 : 20);
      c.fillRect(px + sx, py + sy, n * (1 + (k & 1)), n);
    }
    const b = Math.max(1, s >> 4);
    if (rock) { // bevel: lit top-left, shaded bottom-right
      c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(px, py, s, b); c.fillRect(px, py, b, s);
      c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(px, py + s - b, s, b); c.fillRect(px + s - b, py, b, s);
    } else if (t === T.AIR || t === T.FLOOR) {
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(px, py, s, b); c.fillRect(px, py, b, s);
    } else if (t === T.TOWN || t === T.SHOP) {
      c.fillStyle = 'rgba(60,40,10,.25)'; c.fillRect(px, py + (s >> 1), s, Math.max(1, s >> 5));
    }
    const cx = px + s / 2, cy = py + s / 2;
    if (isGem(t)) {
      const col = GEMS[gemIndex(t)].color, r = s * 0.3;
      c.fillStyle = col;
      c.beginPath(); c.moveTo(cx, cy - r); c.lineTo(cx + r, cy); c.lineTo(cx, cy + r); c.lineTo(cx - r, cy); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.55)';
      c.beginPath(); c.moveTo(cx, cy - r); c.lineTo(cx - r * 0.1, cy - r * 0.1); c.lineTo(cx - r, cy); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = Math.max(1, s / 24);
      c.beginPath(); c.moveTo(cx, cy - r); c.lineTo(cx + r, cy); c.lineTo(cx, cy + r); c.lineTo(cx - r, cy); c.closePath(); c.stroke();
    } else if (t === T.CHEST) {
      const bw = s * 0.7, bh = s * 0.5, bx = cx - bw / 2, by = cy - bh / 2 + s * 0.04;
      c.fillStyle = '#8a4b1f'; c.fillRect(bx, by, bw, bh);
      c.fillStyle = '#b8742f'; c.fillRect(bx, by, bw, bh * 0.4);
      c.fillStyle = '#ffd34d'; c.fillRect(cx - s * 0.05, by, s * 0.1, bh); c.fillRect(bx, by + bh * 0.36, bw, s * 0.06);
      c.strokeStyle = '#2a1608'; c.lineWidth = Math.max(1, s / 20); c.strokeRect(bx, by, bw, bh);
    } else if (t === T.SHOP) {
      c.fillStyle = '#6b4a2a'; c.fillRect(px + s * 0.12, py + s * 0.34, s * 0.76, s * 0.5);
      for (let k = 0; k < 5; k++) { c.fillStyle = k & 1 ? '#f3ece3' : '#d93f3f'; c.fillRect(px + s * 0.08 + k * s * 0.168, py + s * 0.14, s * 0.168, s * 0.24); }
      c.fillStyle = '#ffc857'; c.beginPath(); c.arc(cx, py + s * 0.62, s * 0.1, 0, Math.PI * 2); c.fill();
    } else if (t === T.DREAM) {
      c.fillStyle = 'rgba(190,250,255,.35)'; c.beginPath(); c.arc(cx, cy, s * 0.45, 0, Math.PI * 2); c.fill();
      const r = s * 0.36;
      c.fillStyle = '#e8fcff';
      c.beginPath(); c.moveTo(cx, cy - r); c.lineTo(cx + r, cy - r * 0.1); c.lineTo(cx, cy + r); c.lineTo(cx - r, cy - r * 0.1); c.closePath(); c.fill();
      c.fillStyle = '#7fe3f5'; c.beginPath(); c.moveTo(cx, cy - r * 0.1); c.lineTo(cx + r, cy - r * 0.1); c.lineTo(cx, cy + r); c.closePath(); c.fill();
      c.strokeStyle = '#1a6070'; c.lineWidth = Math.max(1, s / 20);
      c.beginPath(); c.moveTo(cx, cy - r); c.lineTo(cx + r, cy - r * 0.1); c.lineTo(cx, cy + r); c.lineTo(cx - r, cy - r * 0.1); c.closePath(); c.stroke();
    } else if (t === T.CRYSTAL) {
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = Math.max(1, s / 16);
      c.beginPath(); c.moveTo(px + s * 0.2, py + s * 0.8); c.lineTo(px + s * 0.5, py + s * 0.2); c.lineTo(px + s * 0.8, py + s * 0.8); c.stroke();
    } else if (t === T.BEDROCK) {
      c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(px + s * 0.1, py + s * 0.1, s * 0.4, s * 0.15);
    }
  }

  function getChunk(world, cx, cy) {
    const key = cy * 4096 + cx;
    let ch = chunks.get(key);
    if (!ch) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = CH * tsD;
      ch = { cv, used: 0 };
      const c = cv.getContext('2d');
      for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CH; tx++) {
        const x = cx * CH + tx, y = cy * CH + ty;
        if (x < world.size && y < world.size) drawTileAt(c, world, x, y, tx * tsD, ty * tsD, tsD);
      }
      chunks.set(key, ch);
    }
    ch.used = frame;
    return { ch, key };
  }

  function evict() {
    if (chunks.size <= maxChunks) return;
    const arr = [...chunks.entries()].sort((a, b) => a[1].used - b[1].used);
    for (let k = 0; k < arr.length - maxChunks; k++) { if (arr[k][1].used === frame) break; chunks.delete(arr[k][0]); }
  }

  function invalidate(i, size) {
    const x = i % size, y = (i - x) / size;
    chunks.delete(Math.floor(y / CH) * 4096 + Math.floor(x / CH));
  }

  // opts: { pos:{x,y} (float tile pos of miner), cam, time, debug }
  function draw(state, cam, pos, time) {
    frame++;
    const world = state.world, size = world.size;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const ox = Math.round(cam.x * tsD), oy = Math.round(cam.y * tsD);
    const tx0 = Math.max(0, Math.floor(ox / tsD)), ty0 = Math.max(0, Math.floor(oy / tsD));
    const tx1 = Math.min(size - 1, Math.floor((ox + W - 1) / tsD)), ty1 = Math.min(size - 1, Math.floor((oy + H - 1) / tsD));
    for (let cy = Math.floor(ty0 / CH); cy <= Math.floor(ty1 / CH); cy++) {
      for (let cx = Math.floor(tx0 / CH); cx <= Math.floor(tx1 / CH); cx++) {
        const { ch } = getChunk(world, cx, cy);
        ctx.drawImage(ch.cv, cx * CH * tsD - ox, cy * CH * tsD - oy);
      }
    }
    evict();
    const fogOn = state.fogOn;
    // sparkles on revealed gems and the dream diamond
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
      const i = y * size + x, t = world.tiles[i];
      if (!(isGem(t) || t === T.DREAM) || (fogOn && !state.fog[i])) continue;
      const ph = (time * (t === T.DREAM ? 2.2 : 1.3) + hash2(x, y, 3) * 6.28);
      const a = Math.max(0, Math.sin(ph)) ** 6;
      if (a < 0.05) continue;
      const sx = x * tsD - ox + tsD * (0.3 + 0.4 * hash2(x, y, 5)), sy = y * tsD - oy + tsD * (0.25 + 0.3 * hash2(x, y, 6));
      const r = tsD * (t === T.DREAM ? 0.34 : 0.18) * a;
      ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`;
      ctx.fillRect(Math.round(sx - r), Math.round(sy - 1), Math.round(r * 2), 2);
      ctx.fillRect(Math.round(sx - 1), Math.round(sy - r), 2, Math.round(r * 2));
    }
    // mining cracks
    if (state.mine) {
      const m = state.mine, x = m.i % size, y = (m.i - x) / size, f = Math.min(1, m.t / m.need);
      const sx = x * tsD - ox, sy = y * tsD - oy;
      ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = Math.max(1, tsD / 16);
      ctx.beginPath();
      const n = 2 + Math.floor(f * 6);
      for (let k = 0; k < n; k++) {
        const a = hash2(x, y, 90 + k) * 6.28, r = tsD * (0.15 + 0.4 * f);
        ctx.moveTo(sx + tsD / 2, sy + tsD / 2); ctx.lineTo(sx + tsD / 2 + Math.cos(a) * r, sy + tsD / 2 + Math.sin(a) * r);
      }
      ctx.stroke();
    }
    drawMiner(state, pos, ox, oy, time);
    if (fogOn) drawFog(state, tx0, ty0, tx1, ty1, ox, oy, pos);
  }

  function drawMiner(state, pos, ox, oy, time) {
    const p = state.player, s = tsD;
    const sx = Math.round(pos.x * s - ox), sy = Math.round(pos.y * s - oy);
    const bob = state.cd > 0 ? Math.round(Math.sin(time * 30) * s * 0.03) : 0;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(sx + s * 0.22, sy + s * 0.82, s * 0.56, s * 0.1);
    // body
    ctx.fillStyle = '#2f6fd1'; ctx.fillRect(sx + s * 0.28, sy + s * 0.46 + bob, s * 0.44, s * 0.38);
    ctx.fillStyle = '#e8a35f'; ctx.fillRect(sx + s * 0.32, sy + s * 0.26 + bob, s * 0.36, s * 0.24); // face
    ctx.fillStyle = '#ffc931'; ctx.fillRect(sx + s * 0.26, sy + s * 0.14 + bob, s * 0.48, s * 0.16); // helmet
    ctx.fillStyle = '#fff6b0'; ctx.fillRect(sx + s * 0.44 + p.fx * s * 0.12, sy + s * 0.15 + bob + p.fy * s * 0.04, s * 0.12, s * 0.1); // lamp
    // hatchet swing
    if (state.mine) {
      const sw = Math.sin(time * 22) * 0.6;
      const ang = Math.atan2(p.fy, p.fx) + sw;
      const hx = sx + s * 0.5, hy = sy + s * 0.55;
      ctx.strokeStyle = '#7b4a22'; ctx.lineWidth = Math.max(2, s / 12);
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(ang) * s * 0.55, hy + Math.sin(ang) * s * 0.55); ctx.stroke();
      ctx.strokeStyle = '#cfd3d8'; ctx.lineWidth = Math.max(3, s / 7);
      ctx.beginPath(); ctx.moveTo(hx + Math.cos(ang) * s * 0.5, hy + Math.sin(ang) * s * 0.5); ctx.lineTo(hx + Math.cos(ang) * s * 0.66, hy + Math.sin(ang) * s * 0.66); ctx.stroke();
    }
  }

  function drawFog(state, tx0, ty0, tx1, ty1, ox, oy, pos) {
    const size = state.world.size, fog = state.fog, s = tsD;
    ctx.fillStyle = '#050407';
    ctx.beginPath();
    for (let y = ty0; y <= ty1; y++) {
      let run = -1;
      for (let x = tx0; x <= tx1 + 1; x++) {
        const dark = x <= tx1 && !fog[y * size + x];
        if (dark && run < 0) run = x;
        else if (!dark && run >= 0) { ctx.rect(run * s - ox, y * s - oy, (x - run) * s, s); run = -1; }
      }
    }
    ctx.fill();
    // soft lamp light
    const lx = pos.x * s + s / 2 - ox, ly = pos.y * s + s / 2 - oy, R = s * 8;
    const g = ctx.createRadialGradient(lx, ly, s * 2, lx, ly, R);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  return { resize, draw, invalidate, clear: () => chunks.clear(), view, get tileSize() { return tsD; } };
}

// Minimap pixels for the explored area (used by ui.js). Returns an ImageData-compatible Uint8ClampedArray (size*size*4).
export const MAP_COLORS = {
  [T.DIRT]: [122, 82, 51], [T.STONE]: [112, 115, 120], [T.GRANITE]: [150, 110, 105], [T.OBSIDIAN]: [70, 55, 100],
  [T.CRYSTAL]: [110, 224, 240], [T.BEDROCK]: [40, 40, 48], [T.AIR]: [25, 18, 14], [T.TOWN]: [220, 190, 120],
  [T.SHOP]: [255, 90, 70], [T.FLOOR]: [90, 75, 110], [T.CHEST]: [255, 211, 77], [T.DREAM]: [255, 255, 255],
};
export function mapPixels(state) {
  const { world, fog, fogOn } = state, size = world.size, out = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const o = i * 4;
    if (fogOn && !fog[i]) { out[o] = 8; out[o + 1] = 7; out[o + 2] = 10; out[o + 3] = 255; continue; }
    const t = world.tiles[i];
    let c = isGem(t) ? GEMS[gemIndex(t)].color : null;
    let r, g, b;
    if (c) { r = parseInt(c.slice(1, 3), 16); g = parseInt(c.slice(3, 5), 16); b = parseInt(c.slice(5, 7), 16); }
    else { [r, g, b] = MAP_COLORS[t] || [0, 0, 0]; }
    out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
  }
  return out;
}
