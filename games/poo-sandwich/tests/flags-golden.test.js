// Golden values: pin what every URL query gives, recorded from src/flags.js before the parser moved to the kit (S-10).
// Never edit a value to make a test pass: players' links depend on these results. The one edit since capture: the result
// key daySeconds became dayLength (S-10); the query strings still use the old name, which is now an alias.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FLAGS, parseFlags } from '../src/flags.js';

const DEFAULTS = { controls: 'auto', poo: 'hit', dayLength: 180, debug: false };

// [query, the flags that differ from DEFAULTS]. Enum values are case- and space-sensitive; for a repeated name only the
// first occurrence counts, even when it is invalid.
const ROWS = [
  ['', {}],
  ['?', {}],
  ['?&&', {}],
  ['bogus=1', {}],
  ['?toString=1&constructor=1&__proto__=1&hasOwnProperty=1', {}],
  ['lang=sv&poo=choice', {poo: 'choice'}],
  ['controls=auto', {}],
  ['controls=tap', {controls: 'tap'}],
  ['controls=joystick', {controls: 'joystick'}],
  ['controls=TAP', {}],
  ['controls= tap', {}],
  ['controls=dpad', {}],
  ['controls=', {}],
  ['poo=hit', {}],
  ['poo=choice', {poo: 'choice'}],
  ['poo=Choice', {}],
  ['poo=y', {}],
  ['poo=', {}],
  ['daySeconds=10', {dayLength: 10}],
  ['daySeconds=3600', {dayLength: 3600}],
  ['daySeconds=9.99', {}],
  ['daySeconds=3600.5', {}],
  ['daySeconds=60', {dayLength: 60}],
  ['daySeconds=120.5', {dayLength: 120.5}],
  ['daySeconds= 60 ', {dayLength: 60}],
  ['daySeconds=+60', {dayLength: 60}],
  ['daySeconds=1e2', {dayLength: 100}],
  ['daySeconds=0x20', {dayLength: 32}],
  ['daySeconds=Infinity', {}],
  ['daySeconds=abc', {}],
  ['daySeconds=', {}],
  ['daySeconds=%20', {}],
  ['daySeconds=-5', {}],
  ['daySeconds=99999', {}],
  ['debug=1', {debug: true}],
  ['debug=0', {}],
  ['debug=2', {}],
  ['debug=', {}],
  ['debug=x', {}],
  ['controls=tap&controls=joystick', {controls: 'tap'}],
  ['controls=x&controls=tap', {}],
  ['daySeconds=60&daySeconds=120', {dayLength: 60}],
  ['daySeconds=abc&daySeconds=60', {}],
  ['debug=1&debug=0', {debug: true}],
  ['debug=0&debug=1', {}],
  ['debug=x&debug=1', {}],
  ['poo=choice&poo=hit', {poo: 'choice'}],
  ['?controls=tap&poo=choice&daySeconds=60&debug=1', {controls: 'tap', poo: 'choice', dayLength: 60, debug: true}],
  ['?controls=x&poo=y&daySeconds=abc&debug=2', {}],
];

// Added in S-10, not captured: links that were ignored before (each gave DEFAULTS, checked against the old code) and now
// set a flag. `debug` takes Garden Day's boolean spellings; `dayLength` is the new name of `daySeconds` (now an alias).
const NEW_ROWS = [
  ['debug=true', {debug: true}], ['debug=on', {debug: true}], ['debug=yes', {debug: true}], ['debug=TRUE', {debug: true}],
  ['debug=%201%20', {debug: true}], ['debug=false', {}], ['debug=no', {}],
  ['dayLength=60', {dayLength: 60}], ['dayLength=9', {}], ['dayLength=abc', {}],
  ['dayLength=60&daySeconds=120', {dayLength: 60}], ['daySeconds=120&dayLength=60', {dayLength: 60}],
  ['daySeconds=120&dayLength=abc', {dayLength: 120}],
];

test('defaults are unchanged (daySeconds renamed dayLength in S-10)', () => {
  assert.deepEqual({ ...DEFAULT_FLAGS }, DEFAULTS);
  assert.deepEqual(parseFlags(), DEFAULTS);
});

test('parseFlags: every query gives the same flags as before', () => {
  for (const [q, diff] of ROWS) assert.deepEqual(parseFlags(q), { ...DEFAULTS, ...diff }, q);
});

test('S-10: new boolean spellings and the dayLength name', () => {
  for (const [q, diff] of NEW_ROWS) assert.deepEqual(parseFlags(q), { ...DEFAULTS, ...diff }, q);
  assert.equal('daySeconds' in parseFlags('daySeconds=60'), false);
});
