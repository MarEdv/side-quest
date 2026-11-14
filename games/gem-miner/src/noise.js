// 2D value noise and fractal sum (pure, seeded, no tables).
import { hash2 } from './rng.js';

const smooth = (t) => t * t * (3 - 2 * t);

export function valueNoise(x, y, seed = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smooth(x - x0), fy = smooth(y - y0);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}

// Normalised to [0,1].
export function fbm(x, y, seed = 0, octaves = 3) {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * f, y * f, seed + o * 101) * amp;
    norm += amp; amp *= 0.5; f *= 2;
  }
  return sum / norm;
}
