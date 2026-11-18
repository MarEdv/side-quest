// Pure: no DOM. Seeded randomness (S-8): mulberry32 for sequences, createRng for a generator with helpers,
// hash2 for a stateless value per cell. The sequences are pinned by golden tests in every game (tests/rng-golden.test.js):
// saved worlds and tuned levels depend on them, so the arithmetic here must never change.

// Raw generator: returns a function giving floats in [0,1). The seed is taken as it is (>>> 0), so 0 is a valid seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generator with helpers. A seed whose `>>> 0` is 0 (or that is not a number) is replaced by 0x9e3779b9.
export function createRng(seed) {
  const next = mulberry32((Number(seed) >>> 0) || 0x9e3779b9);
  return {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)), // inclusive
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}

// Deterministic value in [0,1) for an integer cell and seed.
export function hash2(x, y, seed = 0) {
  let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const randomSeed = () => Math.floor(Math.random() * 0x7fffffff);
