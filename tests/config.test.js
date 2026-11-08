import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FLAGS, parseFlags } from '../src/config.js';

test('empty query gives defaults', () => {
  assert.deepEqual(parseFlags(''), { ...DEFAULT_FLAGS });
  assert.deepEqual(parseFlags(), { ...DEFAULT_FLAGS });
});

test('parses and coerces every flag', () => {
  const f = parseFlags('?wifeMode=random&dayLength=120&maxActiveQuests=3&questInterval=9.5&difficulty=hard&showVisionCone=0&wifeRoam=off&visionRange=250.5&sound=false&seed=42&debug=1');
  assert.deepEqual(f, {
    wifeMode: 'random', dayLength: 120, maxActiveQuests: 3, questInterval: 9.5,
    difficulty: 'hard', showVisionCone: false, wifeRoam: false, visionRange: 250.5, sound: false, seed: 42, debug: true,
  });
});

test('invalid values fall back to defaults; unknown flags ignored', () => {
  const f = parseFlags('wifeMode=nope&dayLength=abc&maxActiveQuests=1.5&questInterval=-4&difficulty=&sound=maybe&seed=x&debug=2&bogus=1');
  assert.deepEqual(f, { ...DEFAULT_FLAGS });
  assert.equal(f.bogus, undefined);
});

test('seed random keyword and zero quests allowed', () => {
  assert.equal(parseFlags('seed=random').seed, 'random');
  assert.equal(parseFlags('maxActiveQuests=0').maxActiveQuests, 0);
});

test('wifeRoam and visionRange: defaults, parsing and bounds', () => {
  assert.equal(DEFAULT_FLAGS.wifeRoam, true);
  assert.equal(DEFAULT_FLAGS.visionRange, 320);
  assert.equal(parseFlags('wifeRoam=0').wifeRoam, false);
  assert.equal(parseFlags('wifeRoam=false').wifeRoam, false);
  assert.equal(parseFlags('wifeRoam=1').wifeRoam, true);
  assert.equal(parseFlags('wifeRoam=maybe').wifeRoam, true); // invalid -> default
  assert.equal(parseFlags('visionRange=180').visionRange, 180);
  assert.equal(parseFlags('visionRange=10').visionRange, 320); // below min -> default
  assert.equal(parseFlags('visionRange=abc').visionRange, 320);
  assert.equal(parseFlags('visionRange=').visionRange, 320);
});
