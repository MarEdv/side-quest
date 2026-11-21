import test from 'node:test';
import assert from 'node:assert/strict';
import { addScore, normalizeScores, scoresFor, recordRun, loadScores, MAX_SCORES, SCORES_KEY } from '../src/scores.js';
import { createStorage, KEY_PREFIX } from '../src/storage.js';

const e = (score, extra = {}) => ({ score, stars: 3, seed: 1, difficulty: 'normal', date: '2026-11-19', ...extra });

test('best scores are sorted high to low, 5 per drive length', () => {
  let scores = {};
  let r;
  for (const sc of [100, 300, 200, 50, 400, 250]) { r = addScore(scores, 'normal', e(sc)); scores = r.scores; }
  assert.deepEqual(scoresFor(scores, 'normal').map((x) => x.score), [400, 300, 250, 200, 100]);
  assert.equal(MAX_SCORES, 5);
  assert.equal(addScore(scores, 'normal', e(10)).rank, 0);
  assert.equal(addScore(scores, 'normal', e(500)).rank, 1);
  assert.equal(addScore(scores, 'normal', e(260)).rank, 3);
  assert.deepEqual(scoresFor(scores, 'short'), []);
  assert.equal(addScore(scores, 'short', e(5)).rank, 1);
});

test('addScore does not mutate its input; a tie ranks below the older score; negative scores are kept', () => {
  const base = { short: [e(100)] };
  const copy = JSON.stringify(base);
  const r = addScore(base, 'short', e(100, { seed: 2 }));
  assert.equal(JSON.stringify(base), copy);
  assert.equal(r.rank, 2);
  assert.equal(addScore({}, 'short', e(-40)).rank, 1);
});

test('junk in the store is dropped or repaired', () => {
  assert.deepEqual(normalizeScores(null), {});
  assert.deepEqual(normalizeScores([1, 2]), {});
  assert.deepEqual(normalizeScores({ short: 'x', other: [e(1)], normal: [null, { score: 'a' }, e(5, { date: 'yesterday', stars: 99, difficulty: 'x' })] }),
    { normal: [{ score: 5, stars: 5, seed: 1, difficulty: 'normal', date: '' }] });
  assert.equal(addScore({}, 'nope', e(5)).rank, 0);
  assert.equal(addScore({}, 'short', { score: NaN }).rank, 0);
});

function memBackend() {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
}

test('recordRun stores under the-driver.scores and returns the rank', () => {
  const backend = memBackend();
  const st = createStorage(backend);
  assert.equal(KEY_PREFIX, 'the-driver.');
  assert.equal(recordRun(st, { length: 'short', debug: false }, e(120)), 1);
  assert.equal(recordRun(st, { length: 'short', debug: false }, e(80)), 2);
  assert.deepEqual([...backend.m.keys()], ['the-driver.scores']);
  assert.deepEqual(JSON.parse(backend.m.get('the-driver.scores')).short.map((x) => x.score), [120, 80]);
  assert.deepEqual(loadScores(createStorage(backend)).short.map((x) => x.score), [120, 80]);
  assert.equal(SCORES_KEY, 'scores');
});

test('debug runs are not recorded', () => {
  const backend = memBackend();
  assert.equal(recordRun(createStorage(backend), { length: 'short', debug: true }, e(999)), 0);
  assert.equal(backend.m.size, 0);
});

test('a throwing or missing backend never breaks scores: they live in memory for the session', () => {
  const boom = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('x'); } };
  const st = createStorage(boom);
  assert.equal(recordRun(st, { length: 'normal', debug: false }, e(70)), 1);
  assert.equal(recordRun(st, { length: 'normal', debug: false }, e(90)), 1);
  assert.deepEqual(loadScores(st).normal.map((x) => x.score), [90, 70]);
  assert.equal(st.persistent, false);
  const none = createStorage(null);
  assert.equal(recordRun(none, { length: 'short', debug: false }, e(5)), 1);
  assert.equal(loadScores(none).short.length, 1);
  assert.equal(loadScores(createStorage(undefined)).normal, undefined);
});

test('corrupt stored JSON is ignored', () => {
  const backend = memBackend();
  backend.setItem('the-driver.scores', '{not json');
  const st = createStorage(backend);
  assert.deepEqual(loadScores(st), {});
  assert.equal(recordRun(st, { length: 'short', debug: false }, e(1)), 1);
});
