// Game state and rules (pure: no DOM). update(state, input, dt) advances one frame and pushes events into state.events
// (the caller reads them after each update; update clears the list at its start).
import { createWorld, hardnessAt } from './world.js';
import { T, GEM_IDS, isGem, gemIndex, isPassable } from './tiles.js';
import { HATCHETS, canCut, mineTime, bestTier, wear } from './mining.js';
import { GEMS, newInventory, sellAll as ecoSellAll, sellGem as ecoSellGem, buyHatchet as ecoBuy, grantHatchet, prices } from './economy.js';
import { t as tr, num, gemName, hatchetName } from './i18n.js'; // `t` is a tile in this file; texts use the current language

export const STEP_TIME = 0.11;   // seconds per tile walked
export const LAMP_RADIUS = 6;    // tiles revealed around the miner
export const DEBUG_COINS = 99999;
const HINT_TIME = 2.2;

// Offsets of the lamp disc, computed once.
const LAMP = (() => {
  const o = [];
  for (let y = -LAMP_RADIUS; y <= LAMP_RADIUS; y++) for (let x = -LAMP_RADIUS; x <= LAMP_RADIUS; x++) {
    if (x * x + y * y <= LAMP_RADIUS * LAMP_RADIUS + 1) o.push([x, y]);
  }
  return o;
})();

export function createGame({ seed, size, flags = {}, world = null }) {
  const w = world || createWorld(seed, size);
  const fog = new Uint8Array(size * size);
  const s = {
    world: w, seed, size, flags, prices: prices(size),
    phase: 'playing',            // 'playing' | 'won'
    player: { x: w.start.x, y: w.start.y, px: w.start.x, py: w.start.y, fx: 0, fy: 1 }, // px/py: previous tile (slide)
    cd: 0,                       // seconds until the next step / mining action
    mine: null,                  // { i, t, need }
    inv: newInventory({ coins: flags.debug ? DEBUG_COINS : 0 }),
    stats: { time: 0, blocks: 0, gems: 0, coinsEarned: 0 },
    fog, fogOn: flags.fog !== false,
    changes: [],                 // tile indices that differ from the generated world (all became AIR)
    events: [], hint: '', hintT: 0, hintKey: '',
    inTown: true, onShop: false,
  };
  if (!s.fogOn || flags.debug) fog.fill(1); else reveal(s);
  return s;
}

export function reveal(s) {
  if (!s.fogOn) return;
  const { size } = s, p = s.player;
  for (const [ox, oy] of LAMP) {
    const x = p.x + ox, y = p.y + oy;
    if (x >= 0 && y >= 0 && x < size && y < size) s.fog[y * size + x] = 1;
  }
}

export const currentTier = (s) => bestTier(s.inv.hatchets);

export function say(s, text, key = text) {
  s.hint = text; s.hintT = HINT_TIME; s.hintKey = key;
}
const emit = (s, e) => { s.events.push(e); };

function setTile(s, i, t) {
  s.world.tiles[i] = t;
  s.changes.push(i);
  emit(s, { type: 'tile', i });
}

function openChest(s, i) {
  const c = s.world.chests.get(i);
  setTile(s, i, T.AIR);
  s.mine = null;
  if (!c) return;
  let text;
  if (c.kind === 'hatchet') {
    const r = grantHatchet(s.inv, c.tier, s.prices, { spares: !!s.flags.durability });
    const hatchet = hatchetName(HATCHETS[c.tier].id);
    text = r.owned ? tr('spareHatchet', { hatchet, n: num(r.coins) }) : tr('foundHatchet', { hatchet });
    s.stats.coinsEarned += r.coins;
  } else if (c.kind === 'coins') {
    s.inv.coins += c.coins; s.stats.coinsEarned += c.coins;
    text = tr('chestCoins', { n: num(c.coins) });
  } else {
    const id = GEM_IDS[c.gem];
    s.inv.gems[id] += c.count; s.stats.gems += c.count;
    text = tr('chestGems', { n: c.count, gem: gemName(GEMS[c.gem].id) });
  }
  say(s, text);
  emit(s, { type: 'chest', kind: c.kind, text });
}

function finishMine(s, i, t) {
  setTile(s, i, T.AIR);
  s.stats.blocks++;
  s.mine = null;
  if (isGem(t)) {
    const g = GEMS[gemIndex(t)];
    s.inv.gems[g.id]++; s.stats.gems++;
    say(s, tr('plusGem', { gem: gemName(g.id) }));
    emit(s, { type: 'gem', gem: g.id });
  } else emit(s, { type: 'mined' });
  if (s.flags.durability) {
    const tier = currentTier(s);
    if (wear(s.inv, tier)) {
      say(s, tr('broke', { hatchet: hatchetName(HATCHETS[tier].id) }), 'broke');
      emit(s, { type: 'broke', tier });
    }
  }
}

function win(s) {
  s.phase = 'won';
  s.inv.dream = true;
  s.stats.gems++;
  s.mine = null;
  emit(s, { type: 'win' });
}

function stepTo(s, x, y) {
  const p = s.player;
  p.px = p.x; p.py = p.y; p.x = x; p.y = y;
  s.cd = STEP_TIME;
  reveal(s);
  const w = s.world;
  const near = Math.hypot(x - w.town.x, y - w.town.y) <= w.town.r + 0.5;
  s.inTown = near;
  // The shop tile only prompts (D21): walking across the middle of town must not pop the shop up every time.
  const onShop = x === w.shop.x && y === w.shop.y;
  if (onShop && !s.onShop) emit(s, { type: 'atShop' });
  s.onShop = onShop;
  emit(s, { type: 'step' });
}

export function update(s, input, dt) {
  s.events.length = 0;
  if (s.phase !== 'playing') return;
  s.stats.time += dt;
  if (s.hintT > 0) { s.hintT -= dt; if (s.hintT <= 0) { s.hint = ''; s.hintKey = ''; } }
  s.cd -= dt;
  if (input.shop && s.inTown) emit(s, { type: 'shop' });
  const dx = input.dx | 0, dy = input.dy | 0;
  if (!dx && !dy) { s.mine = null; if (s.cd < 0) s.cd = 0; return; }
  const p = s.player;
  p.fx = dx; p.fy = dy;
  if (s.cd > 0) return;
  // Time already spent in this frame since the miner was ready. Carrying it into the next action keeps walking and
  // mining speed the same at 30, 60 or 144 fps (D22); it is at most a step long, so nothing is banked while idle.
  const carry = Math.min(-s.cd, STEP_TIME);
  s.cd = 0;
  const w = s.world, x = p.x + dx, y = p.y + dy;
  if (x < 0 || y < 0 || x >= w.size || y >= w.size) return;
  const i = y * w.size + x, t = w.tiles[i];
  if (isPassable(t)) { s.mine = null; stepTo(s, x, y); s.cd -= carry; return; }
  if (t === T.CHEST) { openChest(s, i); s.cd = 0.12 - carry; return; }
  if (t === T.DREAM) { setTile(s, i, T.FLOOR); win(s); return; }
  const h = hardnessAt(w, x, y), tier = currentTier(s);
  if (!canCut(tier, h)) {
    s.mine = null;
    if (s.hintKey !== 'hard' || s.hintT < HINT_TIME - 0.9) {
      say(s, h >= 99 ? tr('bedrock') : h === 5 ? tr('crystalWall') : tr('tooHard', { hatchet: hatchetName(HATCHETS[tier].id) }), 'hard');
      emit(s, { type: 'toohard' });
    }
    return;
  }
  if (!s.mine || s.mine.i !== i) s.mine = { i, t: carry, need: mineTime(h, tier) };
  else s.mine.t += dt;
  s.mine.need = mineTime(h, tier);
  if (s.mine.t >= s.mine.need) { const over = s.mine.t - s.mine.need; finishMine(s, i, t); s.cd = -over; }
  else if (!s.mine.ticked || s.mine.t - s.mine.ticked > 0.22) { s.mine.ticked = s.mine.t; emit(s, { type: 'hit' }); }
}

// Shop actions (state-level wrappers so stats and events stay in one place).
export function sellAll(s) {
  const r = ecoSellAll(s.inv);
  if (r.ok) { s.stats.coinsEarned += r.coins; emit(s, { type: 'sell', coins: r.coins }); }
  return r;
}
export function sellGem(s, id, n = 1) {
  const r = ecoSellGem(s.inv, id, n);
  if (r.ok) { s.stats.coinsEarned += r.coins; emit(s, { type: 'sell', coins: r.coins }); }
  return r;
}
export function buyHatchet(s, tier) {
  const r = ecoBuy(s.inv, tier, s.prices, { spares: !!s.flags.durability });
  if (r.ok) emit(s, { type: 'buy', tier });
  return r;
}

// Direction and distance from the miner to a tile, for the HUD compass (P-2). dist 0 = already there (within `near`).
export function directionTo(s, tx, ty, near = 0) {
  const dx = tx - s.player.x, dy = ty - s.player.y;
  const dist = Math.round(Math.hypot(dx, dy));
  if (dist <= near) return { dist: 0, arrow: '' };
  const a = Math.atan2(dy, dx); // 0 = east
  const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
  return { dist, arrow: arrows[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8] };
}
export const townDirection = (s) => directionTo(s, s.world.town.x, s.world.town.y, s.world.town.r);
// Only once the Gem hatchet is owned (D13).
export const dreamDirection = (s) => (s.inv.hatchets[3] ? directionTo(s, s.world.dream.x, s.world.dream.y) : null);
