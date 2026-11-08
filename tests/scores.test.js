import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../src/storage.js';
import { createScores, sanitizeArcade, MAX_ENTRIES } from '../src/scores.js';

const fresh = () => createScores(createStorage(null));
const res = (score, extra = {}) => ({ score, won: false, date: '2026-11-08T10:00:00.000Z', summary: 'vision·roam·normal', ...extra });

test('empty board; first score is rank 1 and best', () => {
  const sc = fresh();
  assert.deepEqual(sc.arcade(), []);
  assert.equal(sc.best(), null);
  assert.deepEqual(sc.recordArcade(res(300)), { rank: 1, isBest: true, best: 300 });
  assert.equal(sc.best(), 300);
});

test('ordering, rank and isBest', () => {
  const sc = fresh();
  sc.recordArcade(res(300)); sc.recordArcade(res(500));
  assert.deepEqual(sc.recordArcade(res(400)), { rank: 2, isBest: false, best: 500 });
  assert.deepEqual(sc.recordArcade(res(900, { won: true })), { rank: 1, isBest: true, best: 900 });
  assert.deepEqual(sc.arcade().map((e) => e.score), [900, 500, 400, 300]);
  assert.equal(sc.arcade()[0].won, true);
});

test('ties: the earlier entry ranks higher, a tie with the best is not a new best', () => {
  const sc = fresh();
  sc.recordArcade(res(500, { summary: 'first' }));
  const r = sc.recordArcade(res(500, { summary: 'second' }));
  assert.deepEqual(r, { rank: 2, isBest: false, best: 500 });
  assert.deepEqual(sc.arcade().map((e) => e.summary), ['first', 'second']);
});

test('top 10 truncation; a score below the board gets rank null and is not stored', () => {
  const sc = fresh();
  for (let i = 1; i <= 12; i++) sc.recordArcade(res(i * 100));
  const a = sc.arcade();
  assert.equal(a.length, MAX_ENTRIES);
  assert.equal(a[0].score, 1200); assert.equal(a[9].score, 300);
  assert.deepEqual(sc.recordArcade(res(50)), { rank: null, isBest: false, best: 1200 });
  assert.equal(sc.arcade().length, 10);
  assert.equal(sc.recordArcade(res(300)).rank, null); // ties with the 10th: earlier one stays
  assert.equal(sc.recordArcade(res(350)).rank, 10);
});

test('negative scores are valid', () => {
  const sc = fresh();
  assert.equal(sc.recordArcade(res(-40)).rank, 1);
  assert.equal(sc.recordArcade(res(10)).rank, 1);
});

test('persists across scores objects sharing a backend', () => {
  const m = new Map();
  const b = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
  createScores(createStorage(b)).recordArcade(res(123));
  assert.equal(createScores(createStorage(b)).best(), 123);
});

test('corrupt stored data is recovered, not thrown', () => {
  for (const bad of ['{nope', '"str"', '42', 'null', '{"arcade":"x"}', '{"arcade":[1,null,"a",{"score":"9"},{"score":NaN}]}']) {
    const m = new Map([['sidequest.v1.scores', bad], ['sidequest.v1.progress', bad]]);
    const b = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
    const sc = createScores(createStorage(b));
    assert.deepEqual(sc.arcade(), [], bad);
    assert.deepEqual(sc.levels(), {}, bad);
    assert.equal(sc.recordArcade(res(10)).rank, 1);
    assert.equal(sc.recordLevel('l1', { score: 5, won: true }).best, 5);
  }
});

test('sanitize drops bad entries, fixes fields, sorts and truncates', () => {
  const list = [{ score: 10.6, won: 'yes', date: 'garbage', summary: 5 }, { score: 20, won: true, date: '2026-01-02T00:00:00Z', summary: 'x'.repeat(100) }, null, { score: Infinity }];
  const out = sanitizeArcade(list);
  assert.equal(out.length, 2);
  assert.deepEqual(out[1], { score: 11, won: false, date: '', summary: '' });
  assert.equal(out[0].summary.length, 40);
  assert.equal(sanitizeArcade(Array.from({ length: 30 }, (_, i) => ({ score: i }))).length, 10);
});

test('invalid results are ignored by recordArcade', () => {
  const sc = fresh();
  assert.equal(sc.recordArcade({ score: 'x' }).rank, null);
  assert.equal(sc.recordArcade(null).rank, null);
  assert.deepEqual(sc.arcade(), []);
});

test('level records keep best, sticky won, and report improvement', () => {
  const sc = fresh();
  assert.deepEqual(sc.level('l1'), { best: null, won: false });
  assert.deepEqual(sc.recordLevel('l1', { score: 200, won: false }), { best: 200, won: false, isBest: true });
  assert.deepEqual(sc.recordLevel('l1', { score: 100, won: true }), { best: 200, won: true, isBest: false });
  assert.deepEqual(sc.recordLevel('l1', { score: 400, won: false }), { best: 400, won: true, isBest: true });
  assert.deepEqual(sc.level('l1'), { best: 400, won: true });
  assert.equal(sc.recordLevel('', { score: 1 }), null);
  assert.equal(sc.recordLevel('l2', { score: NaN }), null);
});

test('clearAll wipes arcade and level records', () => {
  const sc = fresh();
  sc.recordArcade(res(10)); sc.recordLevel('l1', { score: 5, won: true });
  sc.clearAll();
  assert.deepEqual(sc.arcade(), []);
  assert.deepEqual(sc.levels(), {});
  assert.equal(sc.best(), null);
});

test('works with a throwing backend (memory fallback)', () => {
  const b = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  const sc = createScores(createStorage(b));
  assert.equal(sc.recordArcade(res(10)).rank, 1);
  assert.equal(sc.best(), 10);
});
