// Golden values: pin the exact sequences of the generator, recorded from the code before it moved to the kit (S-8).
// Never edit a value to make a test pass: a different sequence changes every level that was tuned against it (D-28).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/rng.js';
import { createGame } from '../src/game.js';
import { DEFAULT_FLAGS } from '../src/config.js';

const GOLDEN = {
  0: [0.3588899802416563, 0.10590326134115458, 0.675290479324758, 0.9179345588199794, 0.10157715040259063, 0.30100292386487126, 0.02499035419896245, 0.4663846483454108],
  1: [0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741, 0.9683778982143849, 0.281103502959013, 0.6128388606011868, 0.7207431411370635],
  2: [0.7342509443406016, 0.32499843230471015, 0.28529605525545776, 0.5379551574587822, 0.8752879470121115, 0.6308333419729024, 0.4992015736643225, 0.3572446557227522],
  42: [0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693, 0.17481389874592423, 0.5265925421845168, 0.2732279943302274, 0.6247446539346129],
  2147483647: [0.4290980885270983, 0.12713524978607893, 0.3852774982806295, 0.39639189024455845, 0.11962746665813029, 0.9531875969842076, 0.6806830384302884, 0.9957805015146732],
  '-1': [0.8964226141106337, 0.189478256739676, 0.7156526781618595, 0.9440599093213677, 0.8452364315744489, 0.5391399988438934, 0.6804977387655526, 0.4755720964167267],
  4294967300: [0.9236361971125007, 0.33304587937891483, 0.2216679009143263, 0.08184101991355419, 0.23399724275805056, 0.5084968542214483, 0.0773914884775877, 0.9738619206473231],
};

test('next(): the first eight values for several seeds, including 0, negative and past 2^32', () => {
  for (const [seed, want] of Object.entries(GOLDEN)) {
    const r = createRng(Number(seed));
    assert.deepEqual(Array.from({ length: 8 }, () => r.next()), want, `seed ${seed}`);
  }
});

test('a fractional seed is truncated: 1.5 gives the sequence of 1', () => {
  const r = createRng(1.5);
  assert.deepEqual(Array.from({ length: 8 }, () => r.next()), GOLDEN[1]);
});

test('range, int, pick and chance', () => {
  const r = createRng(7);
  assert.deepEqual(
    [r.range(10, 20), r.range(-1, 1), r.int(1, 6), r.int(0, 0), r.int(-3, 3), r.pick(['a', 'b', 'c', 'd']), r.chance(0.5), r.chance(0.1), r.chance(0.9), r.range(0, 100)],
    [10.117047531530261, -0.8760834848508239, 6, 0, 0, 'b', true, false, true, 72.9822089895606]);
});

test('createGame draws from the generator as the game does: wife timers and the next values', () => {
  const draw = (seed) => {
    const g = createGame({ ...DEFAULT_FLAGS, seed, sound: false }, 'title');
    return [g.wife.timer, g.wife.sweepT, ...Array.from({ length: 4 }, () => g.rng.next())];
  };
  assert.deepEqual(draw(1), [8.948906673234887, 0.01231074531096965, 0.5274470399599522, 0.9810509674716741, 0.9683778982143849, 0.281103502959013]);
  assert.deepEqual(draw(12345), [10.88850547268521, 1.3803851902484894, 0.484205421525985, 0.817934412509203, 0.5094283693470061, 0.34747186047025025]);
  assert.deepEqual(draw(0), [7.473894891329111, 0.4765646760351956, 0.675290479324758, 0.9179345588199794, 0.10157715040259063, 0.30100292386487126]);
  assert.deepEqual(draw(-7), [7.881870337645524, 1.4642809530487284, 0.5442695003002882, 0.48018999374471605, 0.048719558166339993, 0.041189806535840034]);
});
