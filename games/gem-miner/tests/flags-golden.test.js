// Golden values: pin what every URL query gives, recorded from src/flags.js before the parser moved to the kit (S-10).
// Never edit a value to make a test pass: players' links depend on these results. The one edit since capture: the result
// key touchControls became touchScheme (S-10); the query strings still use the old name, which is now an alias.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FLAGS, parseFlags } from '../src/flags.js';

const DEFAULTS = {
  worldSize: 256, seed: null, camera: 'deadzone', fog: true, durability: false,
  touch: 'auto', touchScheme: 'dpad', sound: true, debug: false,
};

// [query, the flags that differ from DEFAULTS]. Values are case- and space-sensitive except worldSize and seed; for a
// repeated name only the first occurrence counts, even when it is invalid.
const ROWS = [
  ['', {}],
  ['?', {}],
  ['?&&', {}],
  ['bogus=1', {}],
  ['?toString=1&constructor=1&__proto__=1&hasOwnProperty=1', {}],
  ['lang=sv&camera=center', {camera: 'center'}],
  ['worldSize=128', {worldSize: 128}],
  ['worldSize=256', {}],
  ['worldSize=512', {worldSize: 512}],
  ['worldSize=999', {}],
  ['worldSize=', {}],
  ['worldSize=128.0', {worldSize: 128}],
  ['worldSize=0x80', {worldSize: 128}],
  ['worldSize= 128 ', {worldSize: 128}],
  ['worldSize=1.28e2', {worldSize: 128}],
  ['worldSize=abc', {}],
  ['worldSize=64', {}],
  ['seed=0', {seed: 0}],
  ['seed=42', {seed: 42}],
  ['seed= 42 ', {seed: 42}],
  ['seed=+42', {seed: 42}],
  ['seed=0042', {seed: 42}],
  ['seed=2147483647', {seed: 2147483647}],
  ['seed=2147483648', {}],
  ['seed=9999999999', {}],
  ['seed=99999999999', {}],
  ['seed=-5', {}],
  ['seed=abc', {}],
  ['seed=', {}],
  ['seed=1.5', {}],
  ['seed=1e3', {}],
  ['seed=random', {}],
  ['camera=center', {camera: 'center'}],
  ['camera=deadzone', {}],
  ['camera=CENTER', {}],
  ['camera= center', {}],
  ['camera=x', {}],
  ['camera=', {}],
  ['touch=auto', {}],
  ['touch=on', {touch: 'on'}],
  ['touch=off', {touch: 'off'}],
  ['touch=ON', {}],
  ['touch= on', {}],
  ['touch=maybe', {}],
  ['touch=', {}],
  ['touchControls=dpad', {}],
  ['touchControls=joystick', {touchScheme: 'joystick'}],
  ['touchControls=JOYSTICK', {}],
  ['touchControls= joystick', {}],
  ['touchControls=gamepad', {}],
  ['touchControls=tap', {}],
  ['touchControls=', {}],
  ['fog=1', {}],
  ['fog=0', {fog: false}],
  ['fog=2', {}],
  ['fog=', {}],
  ['fog=x', {}],
  ['durability=1', {durability: true}],
  ['durability=0', {}],
  ['durability=2', {}],
  ['durability=', {}],
  ['durability=x', {}],
  ['sound=1', {}],
  ['sound=0', {sound: false}],
  ['sound=2', {}],
  ['sound=', {}],
  ['sound=x', {}],
  ['debug=1', {debug: true}],
  ['debug=0', {}],
  ['debug=2', {}],
  ['debug=', {}],
  ['debug=x', {}],
  ['fog=0&fog=1', {fog: false}],
  ['fog=1&fog=0', {}],
  ['fog=x&fog=0', {}],
  ['fog=0&fog=x', {fog: false}],
  ['camera=center&camera=deadzone', {camera: 'center'}],
  ['camera=x&camera=center', {}],
  ['seed=5&seed=6', {seed: 5}],
  ['seed=x&seed=6', {}],
  ['worldSize=128&worldSize=512', {worldSize: 128}],
  ['worldSize=1&worldSize=512', {}],
  ['debug=1&debug=0', {debug: true}],
  ['debug=0&debug=1', {}],
  ['debug=x&debug=1', {}],
  ['touchControls=joystick&touchControls=dpad', {touchScheme: 'joystick'}],
  ['touchControls=x&touchControls=joystick', {}],
  ['?worldSize=128&seed=42&camera=center&fog=0&durability=1&touch=on&touchControls=joystick&sound=0&debug=1', {worldSize: 128, seed: 42, camera: 'center', fog: false, durability: true, touch: 'on', touchScheme: 'joystick', sound: false, debug: true}],
  ['?worldSize=999&seed=abc&camera=x&fog=2&durability=x&touch=maybe&touchControls=gamepad&sound=&debug=2', {}],
];

// Added in S-10, not captured: links that were ignored before (each gave DEFAULTS, checked against the old code) and now
// set a flag. Booleans take Garden Day's spellings; `touchScheme` is the new name of `touchControls` (now an alias).
const NEW_ROWS = [
  ['fog=false', {fog: false}], ['fog=off', {fog: false}], ['fog=no', {fog: false}], ['fog=No', {fog: false}], ['fog=%200%20', {fog: false}],
  ['durability=true', {durability: true}], ['durability=on', {durability: true}], ['durability=yes', {durability: true}],
  ['durability=TRUE', {durability: true}], ['durability=%201%20', {durability: true}],
  ['sound=false', {sound: false}], ['sound=off', {sound: false}], ['sound=no', {sound: false}],
  ['debug=true', {debug: true}], ['debug=on', {debug: true}], ['debug=yes', {debug: true}], ['debug=TRUE', {debug: true}],
  ['touchScheme=joystick', {touchScheme: 'joystick'}], ['touchScheme=dpad', {}], ['touchScheme=JOYSTICK', {}], ['touchScheme=tap', {}],
  ['touchScheme=joystick&touchControls=dpad', {touchScheme: 'joystick'}], ['touchControls=joystick&touchScheme=dpad', {}],
  ['touchControls=joystick&touchScheme=x', {touchScheme: 'joystick'}],
];

test('defaults are unchanged (touchControls renamed touchScheme in S-10)', () => {
  assert.deepEqual({ ...DEFAULT_FLAGS }, DEFAULTS);
  assert.deepEqual(parseFlags(), DEFAULTS);
});

test('parseFlags: every query gives the same flags as before', () => {
  for (const [q, diff] of ROWS) assert.deepEqual(parseFlags(q), { ...DEFAULTS, ...diff }, q);
});

test('S-10: new boolean spellings and the touchScheme name', () => {
  for (const [q, diff] of NEW_ROWS) assert.deepEqual(parseFlags(q), { ...DEFAULTS, ...diff }, q);
  assert.equal('touchControls' in parseFlags('touchControls=joystick'), false);
});
