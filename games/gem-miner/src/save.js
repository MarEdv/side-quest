// Compact, versioned save (pure; storage is done by main.js through storage.js).
// Stores the seed + world size, the tiles that differ from the generated world (sorted index deltas in base 36),
// a fog bitset (base64), inventory, stats and position. Opened chests are the changed chest tiles (implied by the diff).
import { createGame, reveal } from './game.js';
import { createWorld } from './world.js';
import { isPassable } from './tiles.js';
import { newInventory } from './economy.js';
import { WORLD_SIZES } from './flags.js';

export const SAVE_VERSION = 1;

export function packBits(bytes) {
  const out = new Uint8Array((bytes.length + 7) >> 3);
  for (let i = 0; i < bytes.length; i++) if (bytes[i]) out[i >> 3] |= 1 << (i & 7);
  return out;
}
export function unpackBits(packed, n) {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (packed[i >> 3] >> (i & 7)) & 1;
  return out;
}
export function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromBase64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function encodeDeltas(indices) {
  const sorted = [...indices].sort((a, b) => a - b);
  let prev = 0; const parts = [];
  for (const i of sorted) { parts.push((i - prev).toString(36)); prev = i; }
  return parts.join(',');
}
export function decodeDeltas(str, limit) {
  if (str === '') return [];
  const out = []; let cur = 0;
  for (const part of str.split(',')) {
    const d = parseInt(part, 36);
    if (!Number.isInteger(d) || d < 0) return null;
    cur += d;
    if (cur >= limit) return null;
    out.push(cur);
  }
  return out;
}

export function serialize(s) {
  const fogAll = !s.fogOn;
  return {
    v: SAVE_VERSION, seed: s.seed, size: s.size, fogOn: s.fogOn, wear: !!s.flags.durability,
    t: Math.round(s.stats.time * 100) / 100,
    p: [s.player.x, s.player.y],
    mined: encodeDeltas(s.changes),
    fog: fogAll ? '' : toBase64(packBits(s.fog)),
    inv: { coins: s.inv.coins, gems: { ...s.inv.gems }, hatchets: [...s.inv.hatchets], dur: [...s.inv.dur] },
    stats: { blocks: s.stats.blocks, gems: s.stats.gems, coinsEarned: s.stats.coinsEarned },
  };
}

const isInt = (n) => Number.isInteger(n);
const isNum = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

// Returns a restored game state, or null if the data is not a valid save (corrupt, wrong version, tampered).
// A saved game keeps the world settings it was started with (seed, size, fog and, when saved, durability); the URL
// flags only supply display and debug options here (D25). `wear` is optional so saves from before it still load.
export function restore(data, flags = {}) {
  try {
    if (!data || typeof data !== 'object' || data.v !== SAVE_VERSION) return null;
    if (!isInt(data.seed) || data.seed < 0 || !WORLD_SIZES.includes(data.size)) return null;
    const size = data.size, N = size * size;
    if (!isNum(data.t) || !Array.isArray(data.p) || data.p.length !== 2) return null;
    if (typeof data.mined !== 'string') return null;
    const changes = decodeDeltas(data.mined, N);
    if (changes === null) return null;
    const inv = newInventory();
    const si = data.inv;
    if (!si || !isNum(si.coins) || !Array.isArray(si.hatchets) || si.hatchets.length !== 4 || !Array.isArray(si.dur) || si.dur.length !== 4) return null;
    inv.coins = si.coins;
    for (const k of Object.keys(inv.gems)) {
      const n = si.gems && si.gems[k];
      if (n !== undefined && !(isInt(n) && n >= 0)) return null;
      inv.gems[k] = n || 0;
    }
    inv.hatchets = si.hatchets.map(Boolean); inv.hatchets[0] = true;
    inv.dur = si.dur.map((d) => (isNum(d) ? d : 0));
    const st = data.stats || {};
    if (!isNum(st.blocks) || !isNum(st.gems) || !isNum(st.coinsEarned)) return null;
    const fogOn = data.fogOn !== false;
    let fogBytes = null;
    if (fogOn) {
      if (typeof data.fog !== 'string') return null;
      const packed = fromBase64(data.fog);
      if (packed.length !== (N + 7) >> 3) return null;
      fogBytes = unpackBits(packed, N);
    }
    if (data.wear !== undefined && typeof data.wear !== 'boolean') return null;
    const durability = typeof data.wear === 'boolean' ? data.wear : !!flags.durability;
    const world = createWorld(data.seed, size);
    const s = createGame({ seed: data.seed, size, flags: { ...flags, fog: fogOn, durability }, world });
    for (const i of changes) world.tiles[i] = 0;
    s.changes = [...changes];
    s.inv = inv;
    s.stats = { time: data.t, blocks: st.blocks, gems: st.gems, coinsEarned: st.coinsEarned };
    const [x, y] = data.p;
    if (isInt(x) && isInt(y) && x >= 0 && y >= 0 && x < size && y < size && isPassable(world.tiles[y * size + x])) {
      s.player.x = s.player.px = x; s.player.y = s.player.py = y;
    }
    s.inTown = Math.hypot(s.player.x - world.town.x, s.player.y - world.town.y) <= world.town.r + 0.5;
    if (fogBytes && !flags.debug) { s.fog = fogBytes; reveal(s); } // debug keeps the whole map revealed
    return s;
  } catch {
    return null;
  }
}
