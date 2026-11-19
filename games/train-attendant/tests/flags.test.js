import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFlags, DEFAULT_FLAGS } from '../src/flags.js';

test('defaults', () => {
  assert.deepEqual(parseFlags(''), DEFAULT_FLAGS);
  assert.deepEqual(DEFAULT_FLAGS, {
    trip: 'normal', cars: 3, difficulty: 'normal', quests: 'offer', stress: 'solo', seed: null, touch: 'auto', sound: true, debug: false,
  });
});

test('valid values are parsed', () => {
  const f = parseFlags('?trip=long&cars=4&difficulty=hard&quests=assign&stress=contagious&seed=42&touch=on&sound=0&debug=1');
  assert.deepEqual(f, { trip: 'long', cars: 4, difficulty: 'hard', quests: 'assign', stress: 'contagious', seed: 42, touch: 'on', sound: false, debug: true });
  assert.equal(parseFlags('?trip=SHORT').trip, 'short');
  assert.equal(parseFlags('?cars=2.0').cars, 2);
});

test('invalid values fall back to the defaults', () => {
  const f = parseFlags('?trip=x&cars=5&difficulty=nightmare&quests=maybe&stress=y&seed=abc&touch=maybe&sound=&debug=2&unknown=1');
  assert.deepEqual(f, DEFAULT_FLAGS);
  assert.equal(parseFlags('?seed=-5').seed, null);
  assert.equal(parseFlags('?seed=99999999999').seed, null);
  assert.equal(parseFlags('?seed=2147483647').seed, 2147483647);
  assert.equal(parseFlags('?cars=1').cars, 3);
});
