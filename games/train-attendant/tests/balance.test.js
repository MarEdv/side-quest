import test from 'node:test';
import assert from 'node:assert/strict';
import { BOT_KINDS } from '../tools/bots.mjs';
import { playTrip } from '../tools/play.mjs';

// A small version of tools/sim.mjs (the full tables are in docs/DECISIONS.md D39): fixed seeds 1..6, so every run is the
// same; the ranges leave room for small tuning changes but fail when the shape of the balance breaks.
const SEEDS = [1, 2, 3, 4, 5, 6];
const cache = new Map();
const runs = (flags, bot) => {
  const key = JSON.stringify([flags, bot]);
  if (!cache.has(key)) cache.set(key, SEEDS.map((seed) => playTrip(flags, seed, bot)));
  return cache.get(key);
};
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const stars = (flags, bot) => mean(runs(flags, bot).map((r) => r.stars));
const list = (rs, f) => JSON.stringify(rs.map(f));

test('idle play is 1 star on every difficulty', () => {
  assert.deepEqual(BOT_KINDS, ['idle', 'sloppy', 'good']);
  for (const difficulty of ['easy', 'normal', 'hard']) {
    assert.ok(runs({ trip: 'short', difficulty }, 'idle').every((r) => r.stars === 1), difficulty);
  }
});

test('stars rise with skill and fall with difficulty (short trips)', () => {
  const want = { // [min, max] mean stars over the seeds
    easy: { good: [4.2, 5], sloppy: [2.5, 3.5] },
    normal: { good: [3.8, 4.7], sloppy: [1.8, 3.2] },
    hard: { good: [3.2, 4.3], sloppy: [1, 2] },
  };
  for (const [difficulty, bots] of Object.entries(want)) {
    for (const [bot, [lo, hi]] of Object.entries(bots)) {
      const v = stars({ trip: 'short', difficulty }, bot);
      assert.ok(v >= lo && v <= hi, `${bot} ${difficulty}: ${v}`);
    }
    assert.ok(stars({ trip: 'short', difficulty }, 'sloppy') < stars({ trip: 'short', difficulty }, 'good'), difficulty);
  }
  for (const bot of ['sloppy', 'good']) {
    const [e, n, h] = ['easy', 'normal', 'hard'].map((difficulty) => stars({ trip: 'short', difficulty }, bot));
    assert.ok(e >= n && n >= h, `${bot}: ${e} ${n} ${h}`);
  }
});

test('a good player on a normal trip: about 4 stars, a few complaints, quests done; hard is harder', () => {
  const normal = runs({ trip: 'normal', difficulty: 'normal' }, 'good');
  const hard = runs({ trip: 'normal', difficulty: 'hard' }, 'good');
  const s = mean(normal.map((r) => r.stars));
  assert.ok(s >= 3.8 && s <= 4.6, `stars ${s}`);
  const c = normal.map((r) => r.complaints);
  assert.ok(c.some((n) => n > 0) && Math.max(...c) <= 6, `complaints ${c}`); // not flawless, not a struggle
  assert.ok(normal.every((r) => r.questsDone >= 5 && r.questsFailed <= 1), list(normal, (r) => [r.questsDone, r.questsFailed]));
  assert.ok(mean(hard.map((r) => r.complaints)) > mean(c) + 2, list(hard, (r) => r.complaints));
  const h = mean(hard.map((r) => r.stars));
  assert.ok(h >= 3 && h <= 4.2 && h < s, `hard stars ${h}`);
  assert.ok(stars({ trip: 'normal', difficulty: 'normal' }, 'sloppy') >= 1.5, 'sloppy on a normal trip');
});

test('quests are worth doing but do not dominate the score', () => {
  for (const r of runs({ trip: 'normal', difficulty: 'normal' }, 'good')) {
    const share = r.pace.questPoints / r.score;
    assert.ok(share >= 0.15 && share <= 0.4, `quest share ${share}`);
  }
});

test('pace: other needs from the first minute and no long idle stretches on a normal trip (D39)', () => {
  const rs = runs({ trip: 'normal', difficulty: 'normal' }, 'good');
  assert.ok(rs.every((r) => r.pace.firstNeed <= 60), list(rs, (r) => r.pace.firstNeed));
  assert.ok(rs.every((r) => r.pace.needsPerMin >= 10), list(rs, (r) => r.pace.needsPerMin));
  const gaps = rs.map((r) => r.pace.gapMax);
  assert.ok(mean(gaps) <= 10 && Math.max(...gaps) <= 16, `longest stretches with nothing to do: ${gaps}`);
});

test('a short trip has plenty of coffee, snack and question needs, not only tickets (D39)', () => {
  const good = runs({ trip: 'short', difficulty: 'normal' }, 'good');
  assert.ok(good.every((r) => r.pace.nonTicket >= 20 && r.pace.cafe >= 8), list(good, (r) => [r.pace.nonTicket, r.pace.cafe]));
  assert.ok(good.every((r) => r.pace.firstNeed <= 45), list(good, (r) => r.pace.firstNeed));
  // needs come after the ticket check, so a slow player sees fewer, but still more than a handful
  const sloppy = runs({ trip: 'short', difficulty: 'normal' }, 'sloppy');
  assert.ok(sloppy.every((r) => r.pace.nonTicket >= 12), list(sloppy, (r) => r.pace.nonTicket));
});

test('every train length and option stays playable for a good player', () => {
  const want = [[{ cars: 2 }, 4.3], [{ cars: 4 }, 3.5], [{ stress: 'contagious' }, 3.8], [{ quests: 'assign' }, 3.8]];
  for (const [flags, min] of want) {
    const v = stars({ trip: 'short', ...flags }, 'good');
    assert.ok(v >= min, `${JSON.stringify(flags)}: ${v}`);
  }
  assert.ok(stars({ trip: 'short', cars: 4 }, 'sloppy') >= 1.5, 'sloppy with 4 cars');
});
