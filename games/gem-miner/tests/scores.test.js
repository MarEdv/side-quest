import test from 'node:test';
import assert from 'node:assert/strict';
import { addScore, scoresFor, normalizeScores, formatTime, MAX_SCORES } from '../src/scores.js';

test('scores are kept ascending (fastest first) and capped at 5', () => {
  let sc = {};
  for (const t of [900, 300, 600, 1200, 450]) sc = addScore(sc, 256, { time: t }).scores;
  assert.deepEqual(scoresFor(sc, 256).map((e) => e.time), [300, 450, 600, 900, 1200]);
  const slow = addScore(sc, 256, { time: 5000 });
  assert.equal(slow.rank, 0);
  assert.equal(scoresFor(slow.scores, 256).length, MAX_SCORES);
  const fast = addScore(sc, 256, { time: 100 });
  assert.equal(fast.rank, 1);
  assert.deepEqual(scoresFor(fast.scores, 256).map((e) => e.time), [100, 300, 450, 600, 900]);
  assert.equal(addScore(sc, 256, { time: 500 }).rank, 3);
});

test('scores are per world size and the input is not mutated', () => {
  const a = addScore({}, 128, { time: 50 }).scores;
  const frozen = JSON.stringify(a);
  const b = addScore(a, 256, { time: 70 }).scores;
  assert.equal(JSON.stringify(a), frozen);
  assert.equal(scoresFor(b, 128).length, 1); assert.equal(scoresFor(b, 256).length, 1);
});

test('normalize drops junk; formatTime', () => {
  const n = normalizeScores({ 256: [{ time: 'x' }, { time: 5 }, null, { time: -1 }], 128: 'bad', 512: [] });
  assert.deepEqual(n, { 256: [{ time: 5, seed: 0, date: '' }] });
  assert.deepEqual(normalizeScores(null), {});
  assert.equal(formatTime(65), '1:05');
  assert.equal(formatTime(3725), '1:02:05');
  assert.equal(formatTime(-3), '0:00');
});
