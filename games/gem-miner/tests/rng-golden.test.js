// Golden values: pin the exact sequences of the generator, recorded from the code before it moved to the kit (S-8).
// Never edit a value to make a test pass: a saved world is rebuilt from its seed, and a different sequence would scramble it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, hash2 } from '../src/rng.js';
import { createWorld } from '../src/world.js';

const GOLDEN = {
  0: [0.26642920868471265, 0.0003297457005828619, 0.2232720274478197, 0.1462021479383111, 0.46732782293111086, 0.5450490827206522, 0.6152513844426721, 0.6489853798411787],
  1: [0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741, 0.9683778982143849, 0.281103502959013, 0.6128388606011868, 0.7207431411370635],
  2: [0.7342509443406016, 0.32499843230471015, 0.28529605525545776, 0.5379551574587822, 0.8752879470121115, 0.6308333419729024, 0.4992015736643225, 0.3572446557227522],
  42: [0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693, 0.17481389874592423, 0.5265925421845168, 0.2732279943302274, 0.6247446539346129],
  2147483647: [0.4290980885270983, 0.12713524978607893, 0.3852774982806295, 0.39639189024455845, 0.11962746665813029, 0.9531875969842076, 0.6806830384302884, 0.9957805015146732],
  '-1': [0.8964226141106337, 0.189478256739676, 0.7156526781618595, 0.9440599093213677, 0.8452364315744489, 0.5391399988438934, 0.6804977387655526, 0.4755720964167267],
  4294967300: [0.9236361971125007, 0.33304587937891483, 0.2216679009143263, 0.08184101991355419, 0.23399724275805056, 0.5084968542214483, 0.0773914884775877, 0.9738619206473231],
};

test('mulberry32: the first eight values for several seeds; 0 is used as it is; negative and past 2^32 wrap', () => {
  for (const [seed, want] of Object.entries(GOLDEN)) {
    const r = mulberry32(Number(seed));
    assert.deepEqual(Array.from({ length: 8 }, () => r()), want, `seed ${seed}`);
  }
  const f = mulberry32(1.5);
  assert.deepEqual(Array.from({ length: 8 }, () => f()), GOLDEN[1]);
});

test('hash2: fixed values, including negative and fractional coordinates and the default seed', () => {
  const cases = [[0, 0, 0], [1, 2, 3], [-1, -1, 7], [-5, 12, 0x7fffffff], [100, -200, 20], [3, 4], [2.7, -3.2, 5], [7, 9, 0x51ed270b ^ 12345]];
  const want = [0, 0.3797727196943015, 0.5900410932954401, 0.7024265627842396, 0.43538837041705847, 0.3743681332562119, 0.07108966214582324, 0.10801456775516272];
  assert.deepEqual(cases.map((a) => hash2(...a)), want);
});

const fnv = (bytes) => { let h = 0x811c9dc5; for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; } return h; };

test('createWorld(seed, 128): the tile map hash for three seeds', () => {
  assert.equal(fnv(createWorld(1, 128).tiles), 4028467446);
  assert.equal(fnv(createWorld(0x7fffffff, 128).tiles), 1752549444);
  assert.equal(fnv(createWorld(0, 128).tiles), 658802142);
});
