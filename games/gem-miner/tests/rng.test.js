import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, hash2 } from '../src/rng.js';
import { valueNoise, fbm } from '../src/noise.js';

test('mulberry32 is deterministic and in [0,1)', () => {
  const a = mulberry32(7), b = mulberry32(7), c = mulberry32(8);
  const sa = Array.from({ length: 50 }, a), sb = Array.from({ length: 50 }, b), sc = Array.from({ length: 50 }, c);
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  assert.ok(sa.every((v) => v >= 0 && v < 1));
});

test('hash2 and noise are deterministic, bounded and seed dependent', () => {
  assert.equal(hash2(3, 4, 5), hash2(3, 4, 5));
  assert.notEqual(hash2(3, 4, 5), hash2(4, 3, 5));
  assert.notEqual(hash2(3, 4, 5), hash2(3, 4, 6));
  for (let i = 0; i < 200; i++) {
    const n = valueNoise(i * 0.37, i * 0.11, 9), f = fbm(i * 0.37, i * 0.11, 9, 3);
    assert.ok(n >= 0 && n <= 1 && f >= 0 && f <= 1);
    assert.equal(n, valueNoise(i * 0.37, i * 0.11, 9));
  }
});

test('noise is continuous (no jumps between neighbouring samples)', () => {
  let max = 0;
  for (let i = 0; i < 500; i++) max = Math.max(max, Math.abs(valueNoise(i * 0.01, 3, 1) - valueNoise((i + 1) * 0.01, 3, 1)));
  assert.ok(max < 0.05, `max step ${max}`);
});
