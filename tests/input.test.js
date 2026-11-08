import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../src/input.js';

// input.js only needs an EventTarget, so Node's built-in one stands in for window.
const key = (type, code, extra = {}) => Object.assign(new Event(type, { cancelable: true }), { code, key: code, ...extra });

test('arrow/space keydown is preventDefault-ed and reported; keyup releases', () => {
  const t = new EventTarget(), inp = createInput(t);
  const e = key('keydown', 'ArrowLeft');
  t.dispatchEvent(e);
  assert.equal(e.defaultPrevented, true);
  assert.equal(inp.read().left, true);
  t.dispatchEvent(key('keyup', 'ArrowLeft'));
  assert.equal(inp.read().left, false);
  const sp = key('keydown', 'Space');
  t.dispatchEvent(sp);
  assert.equal(sp.defaultPrevented, true);
  assert.equal(inp.read().action, true);
  assert.equal(inp.read().start, true);
});

test('modifier shortcuts pass through and do not register keys', () => {
  const t = new EventTarget(), inp = createInput(t);
  const r = key('keydown', 'KeyR', { metaKey: true });
  t.dispatchEvent(r);
  assert.equal(r.defaultPrevented, false);
  assert.equal(inp.read().restart, false);
  const a = key('keydown', 'KeyA', { ctrlKey: true });
  t.dispatchEvent(a);
  assert.equal(inp.read().left, false);
});

test('blur and Meta keyup clear held keys', () => {
  const t = new EventTarget(), inp = createInput(t);
  t.dispatchEvent(key('keydown', 'KeyW'));
  t.dispatchEvent(new Event('blur'));
  assert.equal(inp.read().up, false);
  t.dispatchEvent(key('keydown', 'KeyD'));
  t.dispatchEvent(key('keyup', 'MetaLeft', { key: 'Meta' }));
  assert.equal(inp.read().right, false);
});
