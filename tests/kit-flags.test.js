import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFlags, parseBool, enumFlag, numberFlag, boolFlag, customFlag } from '../kit/flags.js';

const SCHEMA = {
  mode: { type: 'enum', default: 'a', values: ['a', 'b', 'c'] },
  length: { type: 'number', default: 60, min: 10, max: 100 },
  count: { type: 'number', default: 2, min: 0, max: 5, int: true },
  sound: { type: 'bool', default: true },
  debug: { type: 'bool', default: false },
  seed: { type: 'custom', default: null, parse: (t) => (/^\d+$/.test(t.trim()) ? Number(t.trim()) : undefined) },
};
const DEFAULTS = { mode: 'a', length: 60, count: 2, sound: true, debug: false, seed: null };

test('parseBool: every accepted spelling, any case, spaces ignored; anything else is undefined', () => {
  for (const v of ['1', 'true', 'on', 'yes', 'TRUE', ' Yes ', 1, true]) assert.equal(parseBool(v), true, String(v));
  for (const v of ['0', 'false', 'off', 'no', 'Off', ' 0 ', 0, false]) assert.equal(parseBool(v), false, String(v));
  for (const v of ['', '2', 'maybe', 'y', 2, null, undefined]) assert.equal(parseBool(v), undefined, String(v));
});

test('createFlags: frozen defaults in schema order; ENUMS, NUMBERS and BOOLS derived from the schema', () => {
  const f = createFlags(SCHEMA);
  assert.deepEqual(f.DEFAULTS, DEFAULTS);
  assert.deepEqual(Object.keys(f.DEFAULTS), Object.keys(SCHEMA));
  assert.equal(Object.isFrozen(f.DEFAULTS), true);
  assert.deepEqual(f.ENUMS, { mode: ['a', 'b', 'c'] });
  assert.deepEqual(f.NUMBERS, { length: { min: 10, max: 100, int: false }, count: { min: 0, max: 5, int: true } });
  assert.deepEqual(f.BOOLS, ['sound', 'debug']);
  assert.deepEqual(f.parseFlags(), DEFAULTS);
  assert.deepEqual(f.parseFlags(''), DEFAULTS);
});

test('parseFlags: valid values of every kind; junk, unknown names and out-of-range values fall back', () => {
  const f = createFlags(SCHEMA);
  assert.deepEqual(f.parseFlags('?mode=B&length=12.5&count=5&sound=off&debug=yes&seed=+7'),
    { mode: 'b', length: 12.5, count: 5, sound: false, debug: true, seed: 7 });
  assert.deepEqual(f.parseFlags('mode=x&length=9&count=1.5&sound=2&debug=&seed=-1&bogus=1&constructor=1&__proto__=1'), DEFAULTS);
  assert.deepEqual(f.parseFlags('length=&count=%20&length=Infinity'), DEFAULTS);
});

test('parseFlagValue: typed values (saved settings) and wrong types', () => {
  const f = createFlags(SCHEMA);
  assert.equal(f.parseFlagValue('length', 50), 50);
  assert.equal(f.parseFlagValue('length', ' 50 '), 50);
  assert.equal(f.parseFlagValue('count', 1.5), undefined);
  assert.equal(f.parseFlagValue('sound', false), false);
  assert.equal(f.parseFlagValue('seed', 3), 3);
  for (const v of [null, undefined, {}, [1], NaN, Infinity]) assert.equal(f.parseFlagValue('length', v), undefined);
  assert.equal(f.parseFlagValue('toString', 'x'), undefined);
  assert.equal(f.parseFlagValue('bogus', 1), undefined);
});

test('repeated names: by default the last valid value wins; with firstWins only the first occurrence counts', () => {
  const last = createFlags(SCHEMA);
  assert.equal(last.parseFlags('sound=0&sound=1').sound, true);
  assert.equal(last.parseFlags('sound=0&sound=x').sound, false);
  const first = createFlags(SCHEMA, { firstWins: true });
  assert.equal(first.parseFlags('sound=0&sound=1').sound, false);
  assert.equal(first.parseFlags('sound=x&sound=0').sound, true); // the first is invalid: default
  assert.deepEqual(first.parseFlagEntries('mode=b&length=20&mode=c'), { mode: 'b', length: 20 });
});

test('exactEnums: no trimming or case folding for enums (other kinds unchanged)', () => {
  const f = createFlags(SCHEMA, { exactEnums: true });
  assert.equal(f.parseFlags('mode=B').mode, 'a');
  assert.equal(f.parseFlags('mode= b').mode, 'a');
  assert.equal(f.parseFlags('mode=b').mode, 'b');
  assert.equal(f.parseFlags('sound=OFF').sound, false);
});

test('aliases: an old name sets the new flag; a valid value under the new name wins in either order', () => {
  const f = createFlags(SCHEMA, { aliases: { style: 'mode', seconds: 'length' } });
  assert.deepEqual(f.parseFlagEntries('style=c&seconds=30'), { mode: 'c', length: 30 });
  assert.equal(f.parseFlags('style=c&mode=b').mode, 'b');
  assert.equal(f.parseFlags('mode=b&style=c').mode, 'b');
  assert.equal(f.parseFlags('mode=x&style=c').mode, 'c'); // an invalid new-name value is dropped like any junk
  assert.equal(f.parseFlags('style=x').mode, 'a');
  assert.equal(f.parseFlagValue('style', 'c'), undefined); // aliases are for links only
  assert.equal('style' in f.parseFlags('style=c'), false);
  const first = createFlags(SCHEMA, { aliases: { style: 'mode' }, firstWins: true });
  assert.equal(first.parseFlags('style=c&style=b').mode, 'c');
  assert.equal(first.parseFlags('style=c&mode=x&mode=b').mode, 'c');
});

test('shorthands build the same schema entries', () => {
  const parse = () => 1;
  assert.deepEqual(enumFlag('a', ['a', 'b']), { type: 'enum', default: 'a', values: ['a', 'b'] });
  assert.deepEqual(numberFlag(60, 10, 100), { type: 'number', default: 60, min: 10, max: 100, int: false });
  assert.deepEqual(numberFlag(2, 0, 5, true), { type: 'number', default: 2, min: 0, max: 5, int: true });
  assert.deepEqual(boolFlag(true), { type: 'bool', default: true });
  assert.deepEqual(customFlag(null, parse), { type: 'custom', default: null, parse });
});

test('createFlags rejects a broken schema or alias', () => {
  assert.throws(() => createFlags({ a: { type: 'string', default: '' } }));
  assert.throws(() => createFlags({ a: { type: 'bool' } }));
  assert.throws(() => createFlags({ a: { type: 'custom', default: 1 } }));
  assert.throws(() => createFlags(SCHEMA, { aliases: { old: 'missing' } }));
  assert.throws(() => createFlags(SCHEMA, { aliases: { sound: 'debug' } }));
});
