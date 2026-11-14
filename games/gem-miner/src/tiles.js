// Tile ids and hardness (pure).
export const T = Object.freeze({
  AIR: 0, TOWN: 1, SHOP: 2, DIRT: 3, STONE: 4, GRANITE: 5, OBSIDIAN: 6, CRYSTAL: 7, BEDROCK: 8,
  CHEST: 9, DREAM: 10, FLOOR: 11, GEM0: 12,
});
export const GEM_IDS = Object.freeze(['quartz', 'amethyst', 'topaz', 'emerald', 'sapphire', 'ruby', 'diamond']);
export const ROCK_BY_RING = Object.freeze([T.DIRT, T.STONE, T.GRANITE, T.OBSIDIAN]);
export const RING_NAMES = Object.freeze(['dirt', 'stone', 'granite', 'obsidian']);

export const isGem = (t) => t >= T.GEM0 && t < T.GEM0 + GEM_IDS.length;
export const gemIndex = (t) => t - T.GEM0;
export const isPassable = (t) => t === T.AIR || t === T.TOWN || t === T.SHOP || t === T.FLOOR;
export const isRock = (t) => (t >= T.DIRT && t <= T.CRYSTAL);

export const IMPOSSIBLE = 99;
// Hardness: 0 = walk / pick up (chest, dream diamond), 1 dirt .. 4 obsidian, 5 crystal wall, 99 bedrock.
// A gem is as hard as the ring it sits in (`ring` 0..3 -> hardness 1..4).
export function hardnessOf(tile, ring = 0) {
  if (isPassable(tile) || tile === T.CHEST || tile === T.DREAM) return 0;
  if (isGem(tile)) return ring + 1;
  switch (tile) {
    case T.DIRT: return 1;
    case T.STONE: return 2;
    case T.GRANITE: return 3;
    case T.OBSIDIAN: return 4;
    case T.CRYSTAL: return 5;
    default: return IMPOSSIBLE;
  }
}
