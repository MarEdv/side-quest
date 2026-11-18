import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeBest, judgeRun } from '../src/best.js';
import { createStorage } from '../src/kit/storage.js';

test('sanitizeBest: a finite number above 0, else 0', () => {
  assert.equal(sanitizeBest(1200), 1200);
  for (const v of [null, undefined, 0, -5, NaN, Infinity, '1200', {}, [3]]) assert.equal(sanitizeBest(v), 0, String(v));
});

test('a best score stored before D22 ("1200") still reads, under the same key', () => {
  const m = new Map([['poo-sandwich-best', '1200']]);
  const st = createStorage({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }, 'poo-sandwich-');
  assert.equal(sanitizeBest(st.get('best')), 1200);
  st.set('best', 1500);
  assert.equal(m.get('poo-sandwich-best'), '1500', 'still a bare number string');
  m.set('poo-sandwich-best', 'junk');
  assert.equal(sanitizeBest(st.get('best')), 0);
});

test('judgeRun: a higher score is a new best and is saved', () => {
  assert.deepEqual(judgeRun(1000, 1200, false), { isBest: true, save: true, best: 1200 });
  assert.deepEqual(judgeRun(null, 50, false), { isBest: true, save: true, best: 50 });
  assert.deepEqual(judgeRun(1000, 1000, false), { isBest: false, save: false, best: 1000 });
  assert.deepEqual(judgeRun(1000, 400, false), { isBest: false, save: false, best: 1000 });
  assert.deepEqual(judgeRun(0, 0, false), { isBest: false, save: false, best: 0 });
});

test('judgeRun: a debug run is never a new best and never saved (D22)', () => {
  assert.deepEqual(judgeRun(1000, 9999, true), { isBest: false, save: false, best: 1000 });
  assert.deepEqual(judgeRun(null, 9999, true), { isBest: false, save: false, best: 0 });
});
