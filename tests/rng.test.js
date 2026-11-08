import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/rng.js';

test('same seed gives same sequence', () => {
  const a = createRng(7), b = createRng(7);
  for (let i = 0; i < 50; i++) assert.equal(a.next(), b.next());
});

test('different seeds differ; values in [0,1)', () => {
  const a = createRng(1), b = createRng(2);
  assert.notEqual(a.next(), b.next());
  const r = createRng(3);
  for (let i = 0; i < 1000; i++) { const v = r.next(); assert.ok(v >= 0 && v < 1); }
});

test('int is inclusive and pick returns members', () => {
  const r = createRng(5);
  const seen = new Set();
  for (let i = 0; i < 300; i++) seen.add(r.int(1, 3));
  assert.deepEqual([...seen].sort(), [1, 2, 3]);
  assert.ok(['a', 'b'].includes(r.pick(['a', 'b'])));
});
