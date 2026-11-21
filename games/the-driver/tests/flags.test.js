import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFlags, DEFAULT_FLAGS } from '../src/flags.js';

test('defaults', () => {
  assert.deepEqual(parseFlags(''), DEFAULT_FLAGS);
  assert.deepEqual(DEFAULT_FLAGS, {
    length: 'normal', road: 'highway', steer: 'free', pedals: 'auto', crash: 'soft', view: 'cockpit', difficulty: 'normal',
    seed: null, touch: 'auto', sound: true, debug: false,
  });
});

test('valid values are parsed', () => {
  const f = parseFlags('?length=short&road=country&steer=lanes&pedals=manual&crash=hard&view=hood&difficulty=hard&seed=42&touch=on&sound=0&debug=1');
  assert.deepEqual(f, {
    length: 'short', road: 'country', steer: 'lanes', pedals: 'manual', crash: 'hard', view: 'hood', difficulty: 'hard',
    seed: 42, touch: 'on', sound: false, debug: true,
  });
  assert.equal(parseFlags('?road=COUNTRY').road, 'country');
});

test('invalid values fall back to the defaults', () => {
  const f = parseFlags('?length=x&road=sea&steer=y&pedals=z&crash=maybe&view=roof&difficulty=nightmare&seed=abc&touch=maybe&sound=&debug=2&unknown=1');
  assert.deepEqual(f, DEFAULT_FLAGS);
  assert.equal(parseFlags('?seed=-5').seed, null);
  assert.equal(parseFlags('?seed=99999999999').seed, null);
  assert.equal(parseFlags('?seed=2147483647').seed, 2147483647);
  assert.equal(parseFlags('?seed=0').seed, 0);
});
