import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../kit/storage.js';

const memBackend = () => { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) }; };
const throwing = () => ({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('denied'); } });
const quota = () => { throw new Error('quota'); };

test('JSON round trip under the prefix', () => {
  const b = memBackend(), st = createStorage(b, 'game.');
  assert.equal(st.get('x', 'fb'), 'fb');
  assert.equal(st.set('x', { a: [1, 2], b: 'c' }), true);
  assert.deepEqual(st.get('x'), { a: [1, 2], b: 'c' });
  assert.equal(b.m.get('game.x'), '{"a":[1,2],"b":"c"}');
  assert.equal(st.persistent, true);
  assert.equal(st.remove('x'), true);
  assert.equal(st.get('x'), null);
  assert.equal(b.m.size, 0);
});

test('a prefix is required, and two prefixes do not see each other', () => {
  assert.throws(() => createStorage(memBackend()), TypeError);
  assert.throws(() => createStorage(memBackend(), ''), TypeError);
  const b = memBackend(), one = createStorage(b, 'one.'), two = createStorage(b, 'two.');
  one.set('lang', 'sv');
  assert.equal(two.get('lang'), null);
  assert.deepEqual([...b.m.keys()], ['one.lang']);
});

test('a throwing backend falls back to memory without throwing', () => {
  const st = createStorage(throwing(), 'p.');
  assert.equal(st.get('k', 7), 7);
  assert.equal(st.set('k', [1]), false);
  assert.deepEqual(st.get('k'), [1]);
  assert.equal(st.remove('k'), false);
  assert.equal(st.get('k'), null);
  assert.equal(st.persistent, false);
});

test('a missing backend uses memory', () => {
  for (const b of [null, undefined, {}]) {
    const st = createStorage(b, 'p.');
    assert.equal(st.set('a', 1), false);
    assert.equal(st.get('a'), 1);
    assert.equal(st.text('a'), '1');
    st.remove('a');
    assert.equal(st.get('a', 'gone'), 'gone');
    assert.equal(st.persistent, false);
  }
});

test('a backend whose getter blows up on every call never throws out of the wrapper', () => {
  const b = { get getItem() { throw new Error('SecurityError'); }, setItem() {}, removeItem() {} };
  assert.doesNotThrow(() => { const st = createStorage(b, 'p.'); st.set('a', 1); st.get('a'); st.text('a'); st.remove('a'); });
});

test('corrupt JSON reads as the fallback; text() returns the stored string as it is', () => {
  const b = memBackend(); b.m.set('p.a', '{nope'); b.m.set('p.lang', 'sv'); b.m.set('p.best', '1200');
  const st = createStorage(b, 'p.');
  assert.equal(st.get('a', 'fb'), 'fb');
  assert.equal(st.get('lang'), null, 'a bare word is not JSON');
  assert.equal(st.text('lang'), 'sv');
  assert.equal(st.get('best'), 1200, 'a bare number is');
  assert.equal(st.text('missing'), null);
});

test('unserialisable values are refused and leave the stored value alone', () => {
  const st = createStorage(memBackend(), 'p.');
  st.set('c', 1);
  const o = {}; o.self = o;
  assert.equal(st.set('c', o), false);
  assert.equal(st.set('c', undefined), false);
  assert.equal(st.get('c'), 1);
  assert.equal(st.persistent, true);
});

test('a refused write keeps the session value; other keys are still read from the backend', () => {
  const b = memBackend(); b.m.set('p.progress', '{"v":1}'); b.m.set('p.scores', '{"n":0}');
  b.setItem = quota;
  const st = createStorage(b, 'p.');
  assert.equal(st.set('scores', { n: 1 }), false);
  assert.equal(st.persistent, false);
  assert.deepEqual(st.get('scores'), { n: 1 }, "this session's value, not the older one on disk");
  assert.deepEqual(st.get('progress'), { v: 1 });
});

test('a removal the backend refuses does not bring the old value back', () => {
  const b = memBackend(); b.m.set('p.scores', '{"v":1}');
  b.removeItem = () => { throw new Error('denied'); };
  const st = createStorage(b, 'p.');
  assert.equal(st.remove('scores'), false);
  assert.equal(st.get('scores', 'gone'), 'gone');
  assert.equal(st.text('scores'), null);
  assert.equal(st.persistent, false);
});

test('every write tries the backend again, and a success also delivers what was refused earlier', () => {
  const b = memBackend(), real = b.setItem;
  const st = createStorage(b, 'p.');
  b.setItem = quota;
  st.set('save', { t: 1 });
  st.set('scores', [3]);
  st.set('save', { t: 2 });
  assert.equal(b.m.size, 0);
  assert.equal(st.persistent, false);
  b.setItem = real; // room again
  assert.equal(st.set('lang', 'sv'), true);
  assert.equal(b.m.get('p.save'), '{"t":2}', 'the newest refused value, not the first');
  assert.equal(b.m.get('p.scores'), '[3]');
  assert.equal(b.m.get('p.lang'), '"sv"');
  assert.equal(st.persistent, true);
});

test('a refused removal is delivered later too', () => {
  const b = memBackend(), realRemove = b.removeItem; b.m.set('p.save', '1');
  const st = createStorage(b, 'p.');
  b.removeItem = () => { throw new Error('denied'); };
  st.remove('save');
  b.removeItem = realRemove;
  st.set('other', 1);
  assert.ok(!b.m.has('p.save'));
  assert.equal(st.persistent, true);
});

test('a key that is safely on the backend follows the backend (another tab may have changed it)', () => {
  const b = memBackend(), st = createStorage(b, 'p.');
  st.set('lang', 'en');
  b.m.set('p.lang', '"sv"'); // written by another tab
  assert.equal(st.get('lang'), 'sv');
  b.m.delete('p.lang');
  assert.equal(st.get('lang', 'none'), 'none');
});

test('when a read fails, the value written this session is used', () => {
  const b = memBackend(), st = createStorage(b, 'p.');
  st.set('a', 5);
  b.getItem = () => { throw new Error('denied'); };
  assert.equal(st.get('a'), 5);
  assert.equal(st.get('never', 'fb'), 'fb');
});
