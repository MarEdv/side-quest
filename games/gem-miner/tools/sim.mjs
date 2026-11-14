// Balance bot: plays the real game logic headlessly (update() at 60 Hz) and reports how long it takes to win.
// The bot only targets gems/chests that the fog has revealed. It sweeps a ring in the richest area its hatchet
// can cut, digs to nearby gems that are worth the detour, returns to town to sell and buy the next hatchet when
// it can afford it, and once it owns the Gem hatchet digs to the dream chamber (the HUD compass points the way).
// Usage: node tools/sim.mjs [--size 256] [--seeds 1,2,3] [--durability] [--verbose]
import { createGame, update, sellAll, buyHatchet, STEP_TIME, currentTier } from '../src/game.js';
import { T, isGem, gemIndex, hardnessOf } from '../src/tiles.js';
import { canCut, mineTime } from '../src/mining.js';
import { GEMS, backpackValue } from '../src/economy.js';
import { HATCHETS } from '../src/mining.js';

const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : d; };
const sizes = opt('size', '128,256').split(',').map(Number);
const seeds = opt('seeds', '1,2,3').split(',').map(Number);
const durability = args.includes('--durability');
const verbose = args.includes('--verbose');
const MIN_RATE = Number(opt('rate', '1.5'));   // coins per second a detour must pay
const DT = 1 / 60;
const MAX_TIME = 4 * 3600;

class Heap {
  constructor() { this.a = []; }
  push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}

// A* over the real grid. Cost of a tile = a step, plus the mining time when it is rock. Returns { path, cost } or null.
function astar(s, tx, ty, maxExp = 300000) {
  const w = s.world, size = w.size, tier = currentTier(s);
  const sx = s.player.x, sy = s.player.y;
  const g = new Map(), from = new Map(), closed = new Set();
  const h = (x, y) => (Math.abs(x - tx) + Math.abs(y - ty)) * (STEP_TIME + 0.25); // weighted: fast, near-optimal
  const open = new Heap();
  const sk = sy * size + sx;
  g.set(sk, 0); open.push(h(sx, sy), sk);
  let exp = 0;
  while (open.size && exp++ < maxExp) {
    const [, k] = open.pop();
    if (closed.has(k)) continue;
    closed.add(k);
    const x = k % size, y = (k - x) / size;
    if (x === tx && y === ty) {
      const path = []; let c = k;
      while (c !== sk) { path.push([c % size, Math.floor(c / size)]); c = from.get(c); }
      return { path: path.reverse(), cost: g.get(k) };
    }
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + ax, ny = y + ay;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const nk = ny * size + nx;
      if (closed.has(nk)) continue;
      const t = w.tiles[nk], hd = hardnessOf(t, w.ring[nk]);
      let c = STEP_TIME;
      if (hd > 0) { if (!canCut(tier, hd)) continue; c += mineTime(hd, tier); }
      else if (t === T.CHEST) c += 0.12;
      const ng = g.get(k) + c;
      if (ng < (g.get(nk) ?? Infinity)) { g.set(nk, ng); from.set(nk, k); open.push(ng + h(nx, ny), nk); }
    }
  }
  return null;
}

function nextPrice(s) {
  for (let t = 1; t <= 3; t++) if (!s.inv.hatchets[t]) return { tier: t, price: s.prices[t] };
  return null;
}

function bestCandidate(s, radius = 14) {
  const w = s.world, size = w.size, p = s.player, tier = currentTier(s);
  let best = null;
  for (let y = Math.max(1, p.y - radius); y <= Math.min(size - 2, p.y + radius); y++) {
    for (let x = Math.max(1, p.x - radius); x <= Math.min(size - 2, p.x + radius); x++) {
      const i = y * size + x;
      if (!s.fog[i]) continue;
      const t = w.tiles[i];
      let value = 0;
      if (isGem(t)) { if (!canCut(tier, hardnessOf(t, w.ring[i]))) continue; value = GEMS[gemIndex(t)].value; }
      else if (t === T.CHEST) {
        const c = w.chests.get(i);
        value = c.kind === 'coins' ? c.coins : c.kind === 'gems' ? c.count * GEMS[c.gem].value
          : (s.inv.hatchets[c.tier] ? s.prices[c.tier] / 2 : s.prices[c.tier]);
      } else continue;
      const est = (Math.abs(x - p.x) + Math.abs(y - p.y)) * (STEP_TIME + 0.4);
      const rate = value / (est + 0.5);
      if (!best || rate > best.rate) best = { x, y, value, rate };
    }
  }
  return best;
}

function runOne(size, seed) {
  const s = createGame({ seed, size, flags: { durability, fog: true } });
  const w = s.world;
  const log = [];
  let mode = 'explore', path = [], pi = 0, target = null, tgtKind = '';
  let angle = (seed * 2.399963) % (Math.PI * 2), stepsSinceScan = 0, lap = 0;
  let sold = 0, trips = 0;
  const reach = w.reach;
  const ringFrac = (tier) => (tier === 0 ? 0.30 : tier === 1 ? 0.55 : 0.78);

  const setPath = (tx, ty, kind) => {
    const r = astar(s, tx, ty);
    if (!r) return false;
    path = r.path; pi = 0; target = { x: tx, y: ty }; tgtKind = kind; return true;
  };
  const planExplore = () => {
    const tier = currentTier(s);
    const frac = Math.max(0.12, ringFrac(Math.min(tier, 2)) - lap * 0.06);
    const rho = frac * reach;
    for (let tries = 0; tries < 12; tries++) {
      angle += (9 / rho);
      const tx = Math.round(w.town.x + Math.cos(angle) * rho), ty = Math.round(w.town.y + Math.sin(angle) * rho);
      if (tx < 2 || ty < 2 || tx > size - 3 || ty > size - 3) continue;
      if (hardnessOf(w.tiles[ty * size + tx], w.ring[ty * size + tx]) > HATCHETS[tier].power) { continue; }
      if (setPath(tx, ty, 'explore')) { if (angle > Math.PI * 2 * (lap + 1) + seed) lap++; return; }
    }
    // fallback: head to town
    setPath(w.shop.x, w.shop.y, 'town');
  };

  const decide = () => {
    const np = nextPrice(s);
    const owned3 = s.inv.hatchets[3];
    if (owned3) { if (setPath(w.dream.x, w.dream.y, 'dream')) return; }
    if (np && s.inv.coins + backpackValue(s.inv) >= np.price && !(s.player.x === w.shop.x && s.player.y === w.shop.y)) {
      if (setPath(w.shop.x, w.shop.y, 'town')) return;
    }
    const c = bestCandidate(s);
    if (c && c.rate >= MIN_RATE && setPath(c.x, c.y, 'gem')) return;
    planExplore();
  };

  let frames = 0;
  while (s.phase === 'playing' && s.stats.time < MAX_TIME) {
    frames++;
    // at the shop: sell and buy
    if (tgtKind === 'town' && s.player.x === w.shop.x && s.player.y === w.shop.y) {
      sellAll(s);
      for (let t = 1; t <= 3; t++) if (!s.inv.hatchets[t]) {
        // buy the next tier only (keep order), then loop again
        const np = nextPrice(s);
        if (np && s.inv.coins >= np.price) { buyHatchet(s, np.tier); log.push(`${Math.round(s.stats.time)}s ${HATCHETS[np.tier].name}`); }
      }
      trips++; path = []; target = null; tgtKind = '';
    }
    if (!path.length || pi >= path.length) { decide(); if (!path.length) { if (verbose) console.log('bot stuck at', s.player.x, s.player.y, 'tier', currentTier(s), 'mode', tgtKind); break; } }
    // target consumed (gem mined, chest opened)?
    if (target && tgtKind === 'gem') {
      const t = w.tiles[target.y * size + target.x];
      if (!isGem(t) && t !== T.CHEST) { path = []; target = null; tgtKind = ''; continue; }
    }
    const [nx, ny] = path[pi];
    if (s.player.x === nx && s.player.y === ny) { pi++; stepsSinceScan++; if (pi >= path.length) { tgtKind === 'explore' && (path = []); if (tgtKind !== 'town') { path = []; target = null; tgtKind = ''; } } continue; }
    // keep exploring but notice gems along the way
    if (tgtKind === 'explore' && stepsSinceScan >= 3) {
      stepsSinceScan = 0;
      const c = bestCandidate(s);
      if (c && c.rate >= MIN_RATE && setPath(c.x, c.y, 'gem')) continue;
    }
    // if a replan was needed because a tool change makes the path stale, ignore: tiles only get easier
    const dx = Math.sign(nx - s.player.x), dy = Math.sign(ny - s.player.y);
    update(s, { dx: dx, dy: dx ? 0 : dy }, DT);
    if (s.events.some((e) => e.type === 'broke')) { path = []; target = null; }
  }
  const won = s.phase === 'won';
  return { size, seed, won, time: s.stats.time, blocks: s.stats.blocks, gems: s.stats.gems, coins: s.stats.coinsEarned, log, trips };
}

const fmt = (t) => `${Math.floor(t / 60)}m${String(Math.round(t % 60)).padStart(2, '0')}s`;
for (const size of sizes) {
  const res = [];
  for (const seed of seeds) {
    const r = runOne(size, seed);
    res.push(r);
    console.log(`size ${size} seed ${seed}: ${r.won ? fmt(r.time) : 'DNF ' + fmt(r.time)}  blocks ${r.blocks} gems ${r.gems} coins ${r.coins} trips ${r.trips}  [${r.log.join(', ')}]`);
  }
  const ok = res.filter((r) => r.won);
  if (ok.length) console.log(`  -> size ${size}: mean ${fmt(ok.reduce((a, r) => a + r.time, 0) / ok.length)} (${ok.length}/${res.length} completed)`);
  void verbose;
}
