// Generates the launcher's PNG app icons (no dependencies): node tools/make-icons.mjs
// Design: a dark tile with a 2x2 grid of rounded squares, one colour per kind of game (garden green, amber, coral, blue),
// drawn on a 100x100 canvas and supersampled for smooth edges. The PNG encoder is copied from
// games/garden-day/tools/make-icons.mjs (the launcher never imports from a game).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BG = [0x14, 0x16, 0x1a];
const TILES = [[0x5c, 0xae, 0x4b], [0xf2, 0xb5, 0x44], [0xef, 0x6f, 0x5e], [0x4f, 0x9d, 0xde]];

// Inside a rounded rect (x0,y0)-(x1,y1) with corner radius r?
function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

// opts.round: corner radius of the icon (outside = transparent); opts.grid: scale of the tile grid about (50,50)
// (maskable icons keep the grid inside the 80% safe zone; the background stays full-bleed).
function colorAt(x, y, { round, grid }) {
  if (round && !inRoundRect(x, y, 0, 0, 100, 100, round)) return null;
  const gx = 50 + (x - 50) / grid, gy = 50 + (y - 50) / grid; // point in the grid's own coordinates
  const cells = [[20, 20], [53, 20], [20, 53], [53, 53]]; // top-left corners of 27x27 tiles, 6 apart
  for (let k = 0; k < 4; k++) {
    const [cx, cy] = cells[k];
    if (inRoundRect(gx, gy, cx, cy, cx + 27, cy + 27, 6)) return TILES[k];
  }
  return BG;
}

function render(size, opts, ss = 4) {
  const px = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const c = colorAt(((i + (sx + 0.5) / ss) / size) * 100, ((j + (sy + 0.5) / ss) / size) * 100, opts);
      if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
    }
    const o = (j * size + i) * 4, n = ss * ss;
    if (a) { px[o] = Math.round(r / a); px[o + 1] = Math.round(g / a); px[o + 2] = Math.round(b / a); }
    px[o + 3] = Math.round((255 * a) / n);
  }
  return px;
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); out.write(type, 4, 'ascii'); data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
export function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size); // each row: filter byte 0 + pixels
  for (let j = 0; j < size; j++) rgba.copy(raw, j * (size * 4 + 1) + 1, j * size * 4, (j + 1) * size * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

export const ICONS = [
  ['icon-192.png', 192, { round: 18, grid: 1 }],          // purpose "any"
  ['icon-512.png', 512, { round: 18, grid: 1 }],          // purpose "any"
  ['icon-maskable-512.png', 512, { round: 0, grid: 0.7 }], // purpose "maskable": full-bleed, grid inside the safe zone
  ['icon-180.png', 180, { round: 0, grid: 1 }],           // apple-touch-icon: opaque square, iOS rounds it itself
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
  mkdirSync(dir, { recursive: true });
  for (const [name, size, opts] of ICONS) {
    writeFileSync(join(dir, name), encodePng(size, render(size, opts)));
    console.log(`icons/${name} ${size}x${size}`);
  }
}
