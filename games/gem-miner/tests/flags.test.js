import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFlags, DEFAULT_FLAGS } from '../src/flags.js';

test('defaults', () => {
  assert.deepEqual(parseFlags(''), DEFAULT_FLAGS);
  assert.equal(DEFAULT_FLAGS.worldSize, 256);
  assert.equal(DEFAULT_FLAGS.camera, 'deadzone');
  assert.equal(DEFAULT_FLAGS.fog, true);
  assert.equal(DEFAULT_FLAGS.durability, false);
});

test('valid values are parsed', () => {
  const f = parseFlags('?worldSize=128&seed=42&camera=center&fog=0&durability=1&touch=on&touchControls=joystick&sound=0&debug=1');
  assert.deepEqual(f, { worldSize: 128, seed: 42, camera: 'center', fog: false, durability: true, touch: 'on', touchControls: 'joystick', sound: false, debug: true });
});

test('invalid values fall back to the defaults', () => {
  const f = parseFlags('?worldSize=999&seed=abc&camera=x&fog=2&durability=yes&touch=maybe&touchControls=gamepad&sound=&debug=true');
  assert.deepEqual(f, DEFAULT_FLAGS);
  assert.equal(parseFlags('?seed=-5').seed, null);
  assert.equal(parseFlags('?seed=99999999999').seed, null);
  assert.equal(parseFlags('?worldSize=512').worldSize, 512);
});
