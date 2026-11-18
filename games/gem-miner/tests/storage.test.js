// This game's storage contract (src/storage.js on top of the kit, D32). The round trip and the D24 retry of the same key
// are in save.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, KEY_PREFIX } from '../src/storage.js';

const memBackend = () => { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) }; };
const quota = () => { throw new Error('QuotaExceededError'); };

test('every key is stored as JSON under gem-miner.', () => {
  assert.equal(KEY_PREFIX, 'gem-miner.');
  const b = memBackend(), st = createStorage(b);
  st.set('save', { v: 1, t: 12.5, seed: 3 });
  st.set('scores', { 256: [{ time: 61.2 }] });
  st.set('lang', 'sv');
  assert.deepEqual([...b.m.keys()], ['gem-miner.save', 'gem-miner.scores', 'gem-miner.lang']);
  assert.equal(b.m.get('gem-miner.lang'), '"sv"');
  assert.deepEqual(st.get('save'), { v: 1, t: 12.5, seed: 3 });
});

test('data saved before the kit reads as it did', () => {
  const b = memBackend();
  b.m.set('gem-miner.save', '{"v":1,"t":40,"size":256}');
  b.m.set('gem-miner.scores', '{"256":[{"time":90}]}');
  const st = createStorage(b);
  assert.deepEqual(st.get('save'), { v: 1, t: 40, size: 256 });
  assert.deepEqual(st.get('scores'), { 256: [{ time: 90 }] });
});

test('a refused save is kept for the session and delivered by a later write of any key (D32)', () => {
  const b = memBackend(), real = b.setItem;
  const st = createStorage(b);
  b.setItem = quota;
  assert.equal(st.set('save', { t: 1 }), false);
  assert.equal(st.set('save', { t: 2 }), false);
  assert.deepEqual(st.get('save'), { t: 2 }, 'Continue offers the newest save');
  assert.equal(st.persistent, false);
  b.setItem = real; // room again
  assert.equal(st.set('lang', 'en'), true);
  assert.equal(b.m.get('gem-miner.save'), '{"t":2}');
  assert.equal(st.persistent, true);
});

test('a removed save does not come back, even when the removal is refused', () => {
  const b = memBackend(), st = createStorage(b);
  st.set('save', { t: 1 });
  st.remove('save');
  assert.equal(st.get('save'), null);
  assert.ok(!b.m.has('gem-miner.save'));
  b.m.set('gem-miner.save', '{"t":5}');
  b.removeItem = () => { throw new Error('denied'); };
  assert.equal(st.remove('save'), false);
  assert.equal(st.get('save'), null, 'the refused removal still hides the old save this session');
});

test('a save written by another tab is seen (D32)', () => {
  const b = memBackend(), st = createStorage(b);
  st.set('save', { t: 1 });
  b.m.set('gem-miner.save', '{"t":9}'); // another tab
  assert.deepEqual(st.get('save'), { t: 9 });
});
