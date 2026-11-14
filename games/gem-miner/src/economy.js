// Gems, prices, selling and buying (pure).
import { HATCHETS, bestTier } from './mining.js';

export const GEMS = Object.freeze([
  { id: 'quartz',   name: 'Quartz',   value: 3,   color: '#e8e4dc' },
  { id: 'amethyst', name: 'Amethyst', value: 8,   color: '#a35fe0' },
  { id: 'topaz',    name: 'Topaz',    value: 20,  color: '#ffb52e' },
  { id: 'emerald',  name: 'Emerald',  value: 50,  color: '#2fd47a' },
  { id: 'sapphire', name: 'Sapphire', value: 115, color: '#3d7cff' },
  { id: 'ruby',     name: 'Ruby',     value: 260, color: '#ff3b5c' },
  { id: 'diamond',  name: 'Diamond',  value: 650, color: '#9ff3ff' },
]);
// The one that cannot be sold (E-3). It is not in GEMS' tile table; it lives in inv.dream.
export const DREAM = Object.freeze({ id: 'dream', name: 'Diamond of Your Dreams', value: 0, sellable: false, color: '#ffffff' });
export const GEM_BY_ID = Object.freeze(Object.fromEntries(GEMS.map((g) => [g.id, g])));

// Shop prices by hatchet tier for the default 256 world (wood is free, you start with it). They scale with the world
// size (prices(128) is half, prices(512) double) so a smaller world is finished sooner.
export const PRICES = Object.freeze([0, 140, 2800, 32000]);
export const prices = (size = 256) => PRICES.map((p) => Math.round(p * size / 256 / 5) * 5);

export function newInventory({ coins = 0 } = {}) {
  return {
    coins,
    gems: Object.fromEntries(GEMS.map((g) => [g.id, 0])),
    hatchets: [true, false, false, false],
    dur: HATCHETS.map((h) => (Number.isFinite(h.uses) ? h.uses : 0)),
    dream: false,
  };
}

export const backpackValue = (inv) => GEMS.reduce((s, g) => s + (inv.gems[g.id] || 0) * g.value, 0);
export const gemCount = (inv) => GEMS.reduce((s, g) => s + (inv.gems[g.id] || 0), 0);

export function sellGem(inv, id, n = 1) {
  const g = GEM_BY_ID[id];
  if (!g || !(n > 0)) return { ok: false, reason: id === DREAM.id ? 'unsellable' : 'unknown', coins: 0 };
  const have = inv.gems[id] || 0;
  const k = Math.min(n, have);
  if (k <= 0) return { ok: false, reason: 'none', coins: 0 };
  inv.gems[id] = have - k;
  const coins = k * g.value;
  inv.coins += coins;
  return { ok: true, coins, count: k };
}

export function sellAll(inv) {
  let coins = 0, count = 0;
  for (const g of GEMS) {
    const r = sellGem(inv, g.id, inv.gems[g.id] || 0);
    if (r.ok) { coins += r.coins; count += r.count; }
  }
  return { ok: count > 0, coins, count, reason: count ? undefined : 'none' };
}

// A hatchet below your best is useless unless hatchets wear out (`spares`: then it is a backup), so it is refused
// rather than taking the player's coins for nothing (D23).
export const isObsolete = (inv, tier, spares = false) => !spares && tier < bestTier(inv.hatchets);

export function buyHatchet(inv, tier, table = PRICES, { spares = false } = {}) {
  if (!(Number.isInteger(tier) && tier >= 1 && tier < HATCHETS.length)) return { ok: false, reason: 'unknown' };
  if (inv.hatchets[tier]) return { ok: false, reason: 'owned' };
  if (isObsolete(inv, tier, spares)) return { ok: false, reason: 'worse' };
  if (inv.coins < table[tier]) return { ok: false, reason: 'poor', need: table[tier] - inv.coins };
  inv.coins -= table[tier];
  inv.hatchets[tier] = true;
  inv.dur[tier] = HATCHETS[tier].uses;
  return { ok: true, price: table[tier] };
}

// A hatchet found in a chest: gives the tool, or its half price in coins when you already own it (or a better one,
// unless hatchets wear out: then a lower one is a useful spare).
export function grantHatchet(inv, tier, table = PRICES, { spares = false } = {}) {
  if (inv.hatchets[tier] || isObsolete(inv, tier, spares)) { const c = Math.floor(table[tier] / 2); inv.coins += c; return { owned: true, coins: c }; }
  inv.hatchets[tier] = true; inv.dur[tier] = HATCHETS[tier].uses;
  return { owned: false, coins: 0 };
}
