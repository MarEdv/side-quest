// Mining rules (pure): hatchet tiers, what they can cut, how long it takes, durability.
// Tuning numbers live here; see docs/DECISIONS.md (balance).
export const HATCHETS = Object.freeze([
  { id: 'wood',  name: 'Wood',  power: 2, speed: 1.0, uses: Infinity },
  { id: 'stone', name: 'Stone', power: 3, speed: 1.7, uses: 400 },
  { id: 'steel', name: 'Steel', power: 4, speed: 2.8, uses: 800 },
  { id: 'gem',   name: 'Gem',   power: 5, speed: 4.5, uses: 1500 },
]);
// Seconds to mine one block of hardness 1..5 with a speed-1 hatchet (index = hardness).
export const BASE_TIME = Object.freeze([0, 0.30, 0.55, 0.95, 1.5, 2.5]);

export const canCut = (tier, hardness) => hardness > 0 && hardness <= HATCHETS[tier].power;
export const mineTime = (hardness, tier) => BASE_TIME[hardness] / HATCHETS[tier].speed;

// Best owned hatchet (M-4). Wood is always owned.
export function bestTier(hatchets) {
  for (let i = HATCHETS.length - 1; i > 0; i--) if (hatchets[i]) return i;
  return 0;
}

// Wear one hatchet by one block. Returns true if it broke (wood never breaks, M-5).
export function wear(inv, tier) {
  if (tier === 0) return false;
  inv.dur[tier] -= 1;
  if (inv.dur[tier] <= 0) { inv.hatchets[tier] = false; inv.dur[tier] = 0; return true; }
  return false;
}
