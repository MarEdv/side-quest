import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, createRng, hash2, randomSeed } from '../kit/rng.js';

// Same values as the games' tests/rng-golden.test.js, recorded before the generator moved to the kit.
const RAW = {
  0: [0.26642920868471265, 0.0003297457005828619, 0.2232720274478197, 0.1462021479383111, 0.46732782293111086, 0.5450490827206522, 0.6152513844426721, 0.6489853798411787],
  1: [0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741, 0.9683778982143849, 0.281103502959013, 0.6128388606011868, 0.7207431411370635],
  2: [0.7342509443406016, 0.32499843230471015, 0.28529605525545776, 0.5379551574587822, 0.8752879470121115, 0.6308333419729024, 0.4992015736643225, 0.3572446557227522],
  42: [0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693, 0.17481389874592423, 0.5265925421845168, 0.2732279943302274, 0.6247446539346129],
  2147483647: [0.4290980885270983, 0.12713524978607893, 0.3852774982806295, 0.39639189024455845, 0.11962746665813029, 0.9531875969842076, 0.6806830384302884, 0.9957805015146732],
  '-1': [0.8964226141106337, 0.189478256739676, 0.7156526781618595, 0.9440599093213677, 0.8452364315744489, 0.5391399988438934, 0.6804977387655526, 0.4755720964167267],
  4294967300: [0.9236361971125007, 0.33304587937891483, 0.2216679009143263, 0.08184101991355419, 0.23399724275805056, 0.5084968542214483, 0.0773914884775877, 0.9738619206473231],
};
const ZERO_SEEDED = [0.3588899802416563, 0.10590326134115458, 0.675290479324758, 0.9179345588199794, 0.10157715040259063, 0.30100292386487126, 0.02499035419896245, 0.4663846483454108];
const eight = (f) => Array.from({ length: 8 }, () => f());

test('mulberry32: golden sequences; fractional seeds truncate', () => {
  for (const [seed, want] of Object.entries(RAW)) assert.deepEqual(eight(mulberry32(Number(seed))), want, `seed ${seed}`);
  assert.deepEqual(eight(mulberry32(1.5)), RAW[1]);
});

test('createRng: same sequence as mulberry32 except for the zero seed', () => {
  for (const [seed, want] of Object.entries(RAW)) {
    if (seed === '0') continue;
    const r = createRng(Number(seed));
    assert.deepEqual(eight(r.next), want, `seed ${seed}`);
  }
  assert.deepEqual(eight(createRng(0).next), ZERO_SEEDED);
});

test('createRng(0) equals createRng(0x9e3779b9); mulberry32(0) does not', () => {
  assert.deepEqual(eight(createRng(0).next), eight(createRng(0x9e3779b9).next));
  assert.notDeepEqual(eight(mulberry32(0)), eight(mulberry32(0x9e3779b9)));
  assert.deepEqual(eight(createRng(NaN).next), ZERO_SEEDED);
});

test('createRng helpers: range, int, pick, chance', () => {
  const r = createRng(7);
  assert.deepEqual(
    [r.range(10, 20), r.range(-1, 1), r.int(1, 6), r.int(0, 0), r.int(-3, 3), r.pick(['a', 'b', 'c', 'd']), r.chance(0.5), r.chance(0.1), r.chance(0.9), r.range(0, 100)],
    [10.117047531530261, -0.8760834848508239, 6, 0, 0, 'b', true, false, true, 72.9822089895606]);
});

test('hash2: golden values, negative and fractional coordinates, default seed', () => {
  const cases = [[0, 0, 0], [1, 2, 3], [-1, -1, 7], [-5, 12, 0x7fffffff], [100, -200, 20], [3, 4], [2.7, -3.2, 5], [7, 9, 0x51ed270b ^ 12345]];
  const want = [0, 0.3797727196943015, 0.5900410932954401, 0.7024265627842396, 0.43538837041705847, 0.3743681332562119, 0.07108966214582324, 0.10801456775516272];
  assert.deepEqual(cases.map((a) => hash2(...a)), want);
});

test('randomSeed: an integer in [0, 2^31)', () => {
  for (let i = 0; i < 50; i++) { const s = randomSeed(); assert.ok(Number.isInteger(s) && s >= 0 && s < 0x7fffffff); }
});
