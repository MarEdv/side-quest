// Generates the PNG app icons (no dependencies): node tools/make-icons.mjs
// Design (same as the old inline SVG): green lawn, brown roof band along the top, an orange-shirted figure with a
// skin-coloured head, and a yellow path line. Drawn on a 100x100 canvas, supersampled for smooth edges.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const GREEN = [0x5c, 0xae, 0x4b], ROOF = [0xa8, 0x5d, 0x3b], SHIRT = [0xf2, 0x8c, 0x28], SKIN = [0xf1, 0xc9, 0xa0], PATH = [0xff, 0xd2, 0x3f];

// opts.round: corner radius in 100-units (outside = transparent); opts.fig: scale of the figure/path about (50,50)
// (maskable icons keep the figure inside the 80% safe zone; the lawn and roof stay full-bleed).
function colorAt(x, y, { round, fig }) {
  if (round) { // rounded-rect mask
    const cx = Math.min(Math.max(x, round), 100 - round), cy = Math.min(Math.max(y, round), 100 - round);
    if ((x - cx) ** 2 + (y - cy) ** 2 > round * round) return null;
  }
  const fx = 50 + (x - 50) / fig, fy = 50 + (y - 50) / fig; // point in the figure's own coordinates
  if ((fx - 50) ** 2 + (fy - 42) ** 2 <= 100) return SKIN;      // head r10
  if ((fx - 50) ** 2 + (fy - 62) ** 2 <= 256) return SHIRT;     // body r16
  if (fy >= 87 && fy <= 93 && fx >= 20 && fx <= 80) return PATH; // path line
  if (y < 28) return ROOF;
  return GREEN;
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

const ICONS = [
  ['icon-192.png', 192, { round: 18, fig: 1 }],        // purpose "any"
  ['icon-512.png', 512, { round: 18, fig: 1 }],        // purpose "any"
  ['icon-maskable-512.png', 512, { round: 0, fig: 0.6 }], // purpose "maskable": full-bleed, figure inside the safe zone
  ['icon-180.png', 180, { round: 0, fig: 1 }],         // apple-touch-icon: opaque square, iOS rounds it itself
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
  mkdirSync(dir, { recursive: true });
  for (const [name, size, opts] of ICONS) {
    writeFileSync(join(dir, name), encodePng(size, render(size, opts)));
    console.log(`icons/${name} ${size}x${size}`);
  }
}
