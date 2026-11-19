import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, KEY_PREFIX } from '../src/storage.js';

test('every key is prefixed train-attendant. (the origin is shared by every game)', () => {
  const written = [];
  const backend = { getItem: () => null, setItem: (k) => written.push(k), removeItem: (k) => written.push(k) };
  const st = createStorage(backend);
  st.set('scores', 1); st.set('lang', 'sv'); st.remove('x');
  assert.deepEqual(written, ['train-attendant.scores', 'train-attendant.lang', 'train-attendant.x']);
  assert.equal(KEY_PREFIX, 'train-attendant.');
});

test('the language key the kit uses is train-attendant.lang', () => {
  const store = new Map();
  const st = createStorage({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) });
  st.set('lang', 'sv');
  assert.equal(store.get('train-attendant.lang'), '"sv"');
  assert.equal(st.get('lang'), 'sv');
});
