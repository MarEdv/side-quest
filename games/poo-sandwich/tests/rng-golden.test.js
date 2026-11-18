// Golden values: pin the exact sequences of the generator, recorded from the code before it moved to the kit (S-8).
// Never edit a value to make a test pass: a different sequence changes every day of play.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/kit/rng.js';
import { createGame, update } from '../src/game.js';

const GOLDEN = {
  0: [0.26642920868471265, 0.0003297457005828619, 0.2232720274478197, 0.1462021479383111, 0.46732782293111086, 0.5450490827206522, 0.6152513844426721, 0.6489853798411787],
  1: [0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741, 0.9683778982143849, 0.281103502959013, 0.6128388606011868, 0.7207431411370635],
  2: [0.7342509443406016, 0.32499843230471015, 0.28529605525545776, 0.5379551574587822, 0.8752879470121115, 0.6308333419729024, 0.4992015736643225, 0.3572446557227522],
  42: [0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693, 0.17481389874592423, 0.5265925421845168, 0.2732279943302274, 0.6247446539346129],
  2147483647: [0.4290980885270983, 0.12713524978607893, 0.3852774982806295, 0.39639189024455845, 0.11962746665813029, 0.9531875969842076, 0.6806830384302884, 0.9957805015146732],
  '-1': [0.8964226141106337, 0.189478256739676, 0.7156526781618595, 0.9440599093213677, 0.8452364315744489, 0.5391399988438934, 0.6804977387655526, 0.4755720964167267],
  4294967300: [0.9236361971125007, 0.33304587937891483, 0.2216679009143263, 0.08184101991355419, 0.23399724275805056, 0.5084968542214483, 0.0773914884775877, 0.9738619206473231],
};

test('mulberry32: the first eight values for several seeds; 0 is used as it is', () => {
  for (const [seed, want] of Object.entries(GOLDEN)) {
    const r = mulberry32(Number(seed));
    assert.deepEqual(Array.from({ length: 8 }, () => r()), want, `seed ${seed}`);
  }
});

test('createGame + 1500 update steps with scripted input: the state is the same as before the move', () => {
  const run = (seed) => {
    const g = createGame({}, seed);
    for (let i = 0; i < 1500; i++) update(g, 1 / 60, { moveX: i % 120 < 60 ? 1 : -1, moveY: i % 90 < 30 ? 1 : 0 });
    return { t: g.t, score: g.score, stress: g.stress, spawned: g.spawned, px: g.player.x, py: g.player.y, bx: g.boss.x, by: g.boss.y, tasks: g.tasks.length, stats: g.stats, next: g.rng() };
  };
  assert.deepEqual(run(1), { t: 24.99999999999986, score: 0, stress: 13.39583333333314, spawned: 4, px: 392.2081528017128, py: 512, bx: 625.5040935669646, by: 282.61642375154975, tasks: 4, stats: { tasksDone: 0, pooDone: 0, hits: 0, dodged: 4, pooExpired: 0 }, next: 0.7986842156387866 });
  assert.deepEqual(run(987654), { t: 24.99999999999986, score: 0, stress: 13.691666666666457, spawned: 4, px: 392.2081528017128, py: 512, bx: 287.3189854384843, by: 312.4012925906362, tasks: 4, stats: { tasksDone: 0, pooDone: 0, hits: 0, dodged: 4, pooExpired: 0 }, next: 0.5127791506238282 });
});
