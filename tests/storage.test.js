import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../src/storage.js';

const memBackend = () => { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) }; };
const throwing = () => ({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('denied'); } });

test('JSON round trip under the sidequest.v1. prefix', () => {
  const b = memBackend(), st = createStorage(b);
  assert.equal(st.get('x', 'fb'), 'fb');
  assert.equal(st.set('x', { a: [1, 2], b: 'c' }), true);
  assert.deepEqual(st.get('x'), { a: [1, 2], b: 'c' });
  assert.ok(b.m.has('sidequest.v1.x'));
  assert.equal(st.persistent, true);
  st.remove('x');
  assert.equal(st.get('x'), null);
  assert.equal(b.m.size, 0);
});

test('a throwing backend falls back to memory without throwing', () => {
  const st = createStorage(throwing());
  assert.equal(st.get('k', 7), 7);
  assert.equal(st.set('k', [1]), false);
  assert.deepEqual(st.get('k'), [1]);
  st.remove('k');
  assert.equal(st.get('k'), null);
  assert.equal(st.persistent, false);
});

test('missing backend uses memory', () => {
  for (const b of [null, undefined, {}]) {
    const st = createStorage(b);
    st.set('a', 1);
    assert.equal(st.get('a'), 1);
    assert.equal(st.persistent, false);
  }
});

test('backend that fails only on write keeps the session value', () => {
  const b = memBackend(); b.setItem = () => { throw new Error('quota'); };
  const st = createStorage(b);
  st.set('a', { n: 1 });
  assert.deepEqual(st.get('a'), { n: 1 });
});

test('corrupt JSON in the backend reads as the fallback', () => {
  const b = memBackend(); b.m.set('sidequest.v1.a', '{nope');
  assert.deepEqual(createStorage(b).get('a', 'fb'), 'fb');
});

test('unserialisable values are refused', () => {
  const st = createStorage(memBackend());
  const o = {}; o.self = o;
  assert.equal(st.set('c', o), false);
  assert.equal(st.set('u', undefined), false);
});
