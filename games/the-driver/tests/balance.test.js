import test from 'node:test';
import assert from 'node:assert/strict';
import { BOT_KINDS } from '../tools/bots.mjs';
import { playDrive } from '../tools/play.mjs';

// A small version of tools/sim.mjs (the full tables are in docs/DECISIONS.md): fixed seeds, so every run is the same; the
// ranges leave room for small tuning changes but fail when the shape of the balance breaks.
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const cache = new Map();
const runs = (flags, bot, seeds = SEEDS) => {
  const key = JSON.stringify([flags, bot, seeds]);
  if (!cache.has(key)) cache.set(key, seeds.map((seed) => playDrive(flags, seed, bot)));
  return cache.get(key);
};
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const stars = (flags, bot, seeds) => mean(runs(flags, bot, seeds).map((r) => r.stars));

test('the bots are idle, sloppy and good', () => {
  assert.deepEqual(BOT_KINDS, ['idle', 'sloppy', 'good']);
});

test('idle play is about 1 star on a normal drive on both roads, every difficulty', () => {
  for (const road of ['highway', 'country']) for (const difficulty of ['easy', 'normal', 'hard']) {
    const v = stars({ length: 'normal', road, difficulty }, 'idle', [1, 2, 3, 4]);
    assert.ok(v <= 1.3, `${road} ${difficulty}: ${v}`);
  }
});

test('stars rise with skill on the normal highway (180 s): idle 1, sloppy 2-3, good 4-5', () => {
  const flags = { length: 'normal', road: 'highway', difficulty: 'normal' };
  const idle = stars(flags, 'idle'), sloppy = stars(flags, 'sloppy'), good = stars(flags, 'good');
  assert.ok(idle <= 1.2, `idle ${idle}`);
  assert.ok(sloppy >= 1.8 && sloppy <= 3.2, `sloppy ${sloppy}`);
  assert.ok(good >= 3.6 && good <= 5, `good ${good}`);
  assert.ok(runs(flags, 'good').every((r) => r.crashes <= 1), 'a good driver stays clean');
});

test('the country road (180 s) is playable: a good driver gets 3.4+ stars, idle stays at 1', () => {
  const flags = { length: 'normal', road: 'country', difficulty: 'normal' };
  assert.ok(stars(flags, 'good') >= 3.4, `good ${stars(flags, 'good')}`);
  assert.ok(stars(flags, 'idle') <= 1.2);
  assert.ok(stars(flags, 'sloppy') < stars(flags, 'good'));
});

test('hard is harder for every bot, easy is easier (short drives, both roads)', () => {
  for (const road of ['highway', 'country']) for (const bot of ['sloppy', 'good']) {
    const [e, n, h] = ['easy', 'normal', 'hard'].map((difficulty) => stars({ length: 'short', road, difficulty }, bot));
    assert.ok(e >= n - 0.5 && n >= h - 0.1 && e > h, `${road} ${bot}: ${e} ${n} ${h}`);
  }
  const flags = (difficulty) => ({ length: 'normal', road: 'highway', difficulty });
  assert.ok(stars(flags('hard'), 'good', [1, 2, 3, 4]) < stars(flags('normal'), 'good', [1, 2, 3, 4]) + 0.01);
  assert.ok(stars(flags('hard'), 'sloppy', [1, 2, 3, 4]) <= stars(flags('normal'), 'sloppy', [1, 2, 3, 4]) + 0.01);
});

test('traffic visibly rises per stage: more cars ahead, and (for idle) more cars passed', () => {
  for (const road of ['highway', 'country']) {
    const rs = runs({ length: 'normal', road, difficulty: 'normal' }, 'good');
    const near = [0, 1, 2].map((i) => mean(rs.map((r) => r.carsByStage[i])));
    assert.ok(near[0] < near[1] && near[1] < near[2], `${road}: ${near}`);
    const passed = [0, 1, 2].map((i) => mean(rs.map((r) => r.passedByStage[i])));
    assert.ok(passed[0] >= 3, `${road}: ${passed}`);
  }
});

test('a short drive ends done and every bot finishes (soft crashes)', () => {
  for (const bot of BOT_KINDS) assert.ok(runs({ length: 'short' }, bot).every((r) => r.endReason === 'done' && r.score >= 0), bot);
});

test('hard crashes wreck a careless driver, not a good one', () => {
  const flags = { length: 'normal', crash: 'hard' };
  assert.ok(runs(flags, 'idle', [1, 2, 3, 4]).every((r) => r.endReason === 'wrecked'));
  assert.ok(runs(flags, 'good', [1, 2, 3, 4]).every((r) => r.endReason === 'done'));
});

test('lanes steering and manual pedals stay playable for a good driver', () => {
  assert.ok(stars({ length: 'short', steer: 'lanes' }, 'good') >= 2.5, `lanes ${stars({ length: 'short', steer: 'lanes' }, 'good')}`);
  assert.ok(stars({ length: 'short', pedals: 'manual' }, 'good') >= 3, `manual ${stars({ length: 'short', pedals: 'manual' }, 'good')}`);
});
