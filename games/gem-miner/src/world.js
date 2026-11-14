// World generation (pure): typed arrays, deterministic per (seed, size).
// tiles[i] = tile id at i = y*size + x; ring[i] = difficulty ring 0..3 (dirt, stone, granite, obsidian) of the cell.
import { mulberry32, hash2 } from './rng.js';
import { fbm } from './noise.js';
import { T, ROCK_BY_RING, hardnessOf, isGem } from './tiles.js';

export const TOWN_R = 4.5;
// Ring boundaries as a fraction of the distance from the town to the bedrock edge (noise adds +-0.07 ragged edges).
export const RING_EDGES = Object.freeze([0.18, 0.42, 0.68]);
// Gem chance per rock cell, per ring, before the vein multiplier; and the gem mix (quartz..diamond weights).
export const GEM_DENSITY = Object.freeze([0.020, 0.021, 0.022, 0.024]);
export const GEM_MIX = Object.freeze([
  [70, 25, 5, 0, 0, 0, 0],
  [30, 38, 24, 8, 0, 0, 0],
  [0, 12, 32, 34, 17, 5, 0],
  [0, 0, 8, 25, 35, 24, 8],
]);
// Chest loot: coins [min,max] per ring.
export const CHEST_COINS = Object.freeze([[15, 40], [50, 120], [150, 400], [400, 1000]]);
export const DREAM_FRACTION = 0.8;

export function createWorld(seed, size) {
  const N = size * size;
  const tiles = new Uint8Array(N);
  const ring = new Uint8Array(N);
  const cx = size >> 1, cy = size >> 1;
  const reach = size / 2 - 1;
  const rng = mulberry32(seed ^ 0x51ed270b);
  const idx = (x, y) => y * size + x;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = idx(x, y);
      if (x === 0 || y === 0 || x === size - 1 || y === size - 1) { tiles[i] = T.BEDROCK; ring[i] = 3; continue; }
      const d = Math.hypot(x - cx, y - cy);
      const r = d / reach + (fbm(x / 22, y / 22, seed ^ 0x1a2b, 3) - 0.5) * 0.14;
      const rg = r < RING_EDGES[0] ? 0 : r < RING_EDGES[1] ? 1 : r < RING_EDGES[2] ? 2 : 3;
      ring[i] = rg;
      if (d <= TOWN_R) { tiles[i] = T.TOWN; ring[i] = 0; continue; }
      tiles[i] = ROCK_BY_RING[rg];
      // gems: veins (low-frequency noise) make rich and poor areas
      const vein = fbm(x / 9, y / 9, seed ^ 0x7e57, 2);
      const mult = vein < 0.5 ? 0.35 : 0.35 + (vein - 0.5) * 11;
      if (hash2(x, y, seed ^ 0x6e11) < GEM_DENSITY[rg] * mult) {
        const mix = GEM_MIX[rg];
        let tot = 0; for (const w of mix) tot += w;
        let pick = hash2(x, y, seed ^ 0x9e3) * tot, g = 0;
        while (g < mix.length - 1 && pick >= mix[g]) { pick -= mix[g]; g++; }
        tiles[i] = T.GEM0 + g;
      }
    }
  }
  tiles[idx(cx, cy)] = T.SHOP;

  // Dream chamber: 5x5 crystal wall around a 3x3 floor holding the diamond, inside a 9x9 block of obsidian.
  const ang = rng() * Math.PI * 2;
  const dd = DREAM_FRACTION * reach;
  const dx = Math.min(size - 8, Math.max(7, Math.round(cx + Math.cos(ang) * dd)));
  const dy = Math.min(size - 8, Math.max(7, Math.round(cy + Math.sin(ang) * dd)));
  for (let y = dy - 4; y <= dy + 4; y++) {
    for (let x = dx - 4; x <= dx + 4; x++) {
      const i = idx(x, y);
      ring[i] = 3;
      const ax = Math.abs(x - dx), ay = Math.abs(y - dy), m = Math.max(ax, ay);
      tiles[i] = m === 2 ? T.CRYSTAL : m < 2 ? T.FLOOR : T.OBSIDIAN;
    }
  }
  tiles[idx(dx, dy)] = T.DREAM;
  const dream = { x: dx, y: dy };
  const chamber = { x0: dx - 2, y0: dy - 2, x1: dx + 2, y1: dy + 2 };

  // Chests.
  const chests = new Map(); // tile index -> { id, kind, tier?, coins?, gem?, count? }
  const chestList = [];
  const farFromDream = (x, y) => Math.max(Math.abs(x - dx), Math.abs(y - dy)) > 7;
  const isRockCell = (x, y) => {
    if (x < 2 || y < 2 || x > size - 3 || y > size - 3) return false;
    const t = tiles[idx(x, y)];
    return (t >= T.DIRT && t <= T.OBSIDIAN) || isGem(t);
  };
  const place = (x, y, props) => {
    const i = idx(x, y);
    const c = { id: chestList.length, x, y, ...props };
    tiles[i] = T.CHEST; chests.set(i, c); chestList.push(c);
    return c;
  };
  const findCell = (pred) => {
    for (let tries = 0; tries < 20000; tries++) {
      const x = 2 + Math.floor(rng() * (size - 4)), y = 2 + Math.floor(rng() * (size - 4));
      if (!isRockCell(x, y) || !farFromDream(x, y) || chests.has(idx(x, y))) continue;
      if (pred(x, y, Math.hypot(x - cx, y - cy) / reach, ring[idx(x, y)])) return { x, y };
    }
    return null;
  };
  // Guaranteed hatchets: stone in the dirt ring close to town, steel in the granite ring (cut with the stone hatchet).
  const sCell = findCell((x, y, r, rg) => rg === 0 && Math.hypot(x - cx, y - cy) >= TOWN_R + 3 && r < RING_EDGES[0] - 0.02);
  if (sCell) place(sCell.x, sCell.y, { kind: 'hatchet', tier: 1 });
  const hCell = findCell((x, y, r, rg) => rg === 2 && r > RING_EDGES[1] + 0.09 && r < RING_EDGES[1] + 0.2);
  if (hCell) place(hCell.x, hCell.y, { kind: 'hatchet', tier: 2 });
  // Scatter: coins or a few gems, richer further out.
  const count = Math.round(size * size / 1500);
  for (let k = 0; k < count; k++) {
    const c = findCell((x, y, r, rg) => Math.hypot(x - cx, y - cy) > TOWN_R + 2);
    if (!c) break;
    const rg = ring[idx(c.x, c.y)];
    if (rng() < 0.65) {
      const [lo, hi] = CHEST_COINS[rg];
      place(c.x, c.y, { kind: 'coins', coins: Math.round(lo + rng() * (hi - lo)) });
    } else {
      const mix = GEM_MIX[rg]; let tot = 0; for (const w of mix) tot += w;
      let pick = rng() * tot, g = 0;
      while (g < mix.length - 1 && pick >= mix[g]) { pick -= mix[g]; g++; }
      place(c.x, c.y, { kind: 'gems', gem: g, count: 2 + Math.floor(rng() * 3) });
    }
  }

  return {
    seed, size, tiles, ring, idx,
    town: { x: cx, y: cy, r: TOWN_R }, shop: { x: cx, y: cy }, start: { x: cx, y: cy + 2 },
    dream, chamber, chests, chestList, reach,
  };
}

export const tileAt = (w, x, y) => (x < 0 || y < 0 || x >= w.size || y >= w.size) ? T.BEDROCK : w.tiles[y * w.size + x];
export const hardnessAt = (w, x, y) => {
  if (x < 0 || y < 0 || x >= w.size || y >= w.size) return 99;
  const i = y * w.size + x;
  return hardnessOf(w.tiles[i], w.ring[i]);
};

// Flood fill from `from`: every cell reachable by walking and cutting rock of hardness <= power. Chests and the dream
// diamond count as reachable cells. Returns Uint8Array (1 = reachable).
export function floodReach(w, power, from = w.start) {
  const { size } = w;
  const seen = new Uint8Array(size * size);
  const stack = [from.y * size + from.x];
  seen[stack[0]] = 1;
  while (stack.length) {
    const i = stack.pop();
    const x = i % size, y = (i - x) / size;
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + ax, ny = y + ay;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const j = ny * size + nx;
      if (seen[j]) continue;
      const h = hardnessOf(w.tiles[j], w.ring[j]);
      if (h > power) continue;
      seen[j] = 1; stack.push(j);
    }
  }
  return seen;
}
