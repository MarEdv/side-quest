import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, KEY_PREFIX } from '../src/storage.js';

test('every key is prefixed the-driver. (the origin is shared by every game)', () => {
  const written = [];
  const backend = { getItem: () => null, setItem: (k) => written.push(k), removeItem: (k) => written.push(k) };
  const st = createStorage(backend);
  st.set('scores', 1); st.set('lang', 'sv'); st.remove('x');
  assert.deepEqual(written, ['the-driver.scores', 'the-driver.lang', 'the-driver.x']);
  assert.equal(KEY_PREFIX, 'the-driver.');
});

test('the language key the kit uses is the-driver.lang', () => {
  const store = new Map();
  const st = createStorage({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) });
  st.set('lang', 'sv');
  assert.equal(store.get('the-driver.lang'), '"sv"');
  assert.equal(st.get('lang'), 'sv');
});
