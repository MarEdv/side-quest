import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrack, segmentAt, heightAt, stageAt, stageAtZ, laneX, laneAt, stageName } from '../src/track.js';
import { CFG } from '../src/config.js';

test('the same seed gives the same road, another seed another road', () => {
  const a = createTrack(5, { length: 'short' }), b = createTrack(5, { length: 'short' }), c = createTrack(6, { length: 'short' });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.segments.map((s) => s.curve), c.segments.map((s) => s.curve));
});

test('the road is long enough for a whole drive at top speed plus the draw distance', () => {
  for (const length of ['normal', 'short']) {
    const t = createTrack(1, { length });
    assert.ok(t.length >= CFG.length[length] * CFG.player.topSpeed + CFG.track.extra, length);
    assert.equal(t.segments.length * t.segLen, t.length);
    assert.equal(t.segLen, 5);
    t.segments.forEach((s, i) => { assert.equal(s.index, i); assert.equal(s.z, i * 5); });
  }
});

test('curvature stays in -1..1, there are left and right curves, straights and hills', () => {
  for (const seed of [1, 2, 3]) {
    const t = createTrack(seed, {});
    const c = t.segments.map((s) => s.curve);
    assert.ok(c.every((v) => v >= -1 && v <= 1));
    assert.ok(c.some((v) => v > 0.3) && c.some((v) => v < -0.3) && c.some((v) => v === 0), `seed ${seed}`);
    const y = t.segments.map((s) => s.y);
    assert.ok(Math.max(...y) - Math.min(...y) > 3, 'hills');
    // smooth: no height jump between neighbours larger than 0.6 m per 5 m
    for (let i = 1; i < y.length; i++) assert.ok(Math.abs(y[i] - y[i - 1]) < 0.6, `jump at ${i}`);
    for (let i = 1; i < c.length; i++) assert.ok(Math.abs(c[i] - c[i - 1]) < 0.2, `curve jump at ${i}`);
  }
});

test('lanes: highway has 3 lanes of 3.6 m, country 2', () => {
  const h = createTrack(1, { road: 'highway' }), c = createTrack(1, { road: 'country' });
  assert.deepEqual([0, 1, 2].map((l) => laneX(h, l)), [-3.6, 0, 3.6]);
  assert.deepEqual([0, 1].map((l) => laneX(c, l)), [-1.8, 1.8]);
  assert.equal(h.halfWidth, 5.4);
  assert.equal(c.halfWidth, 3.6);
  assert.equal(h.barrier, 5.4 + 2.5);
  assert.equal(laneAt(h, 3), 2);
  assert.equal(laneAt(h, -100), 0);
  assert.equal(laneAt(c, 0.5), 1);
  assert.equal(h.road, 'highway');
});

test('stageAt splits the time into three equal parts', () => {
  assert.deepEqual([0, 59.99, 60, 119.99, 120, 179.99, 180, 500].map((t) => stageAt(t, 180)), [0, 0, 1, 1, 2, 2, 2, 2]);
  assert.deepEqual([0, 19.9, 20, 39.9, 40, 59].map((t) => stageAt(t, 60)), [0, 0, 1, 1, 2, 2]);
  assert.equal(stageAt(-5, 60), 0);
  assert.deepEqual([0, 1, 2].map(stageName), ['afternoon', 'sunset', 'night']);
});

test('scenery follows the stage: fields in the afternoon, forest at sunset, city at night', () => {
  const t = createTrack(3, {});
  const kinds = [new Set(), new Set(), new Set()];
  for (const s of t.segments) for (const o of s.scenery) {
    kinds[stageAtZ(t, s.z)].add(o.kind);
    assert.ok(o.offset >= t.barrier + 1, 'beyond the barrier');
    assert.ok(o.side === 1 || o.side === -1);
  }
  assert.deepEqual([...kinds[0]].sort(), ['fence', 'field', 'tree']);
  assert.deepEqual([...kinds[1]].sort(), ['pine', 'rock']);
  assert.deepEqual([...kinds[2]].sort(), ['building', 'lamp']);
  assert.equal(stageAtZ(t, t.stageZ[0] - 1), 0);
  assert.equal(stageAtZ(t, t.stageZ[0]), 1);
  assert.equal(stageAtZ(t, t.stageZ[1]), 2);
  assert.ok(t.stageZ[0] < t.stageZ[1] && t.stageZ[1] < t.length);
});

test('segmentAt and heightAt clamp to the road and interpolate', () => {
  const t = createTrack(2, { length: 'short' });
  assert.equal(segmentAt(t, 0).index, 0);
  assert.equal(segmentAt(t, 4.99).index, 0);
  assert.equal(segmentAt(t, 5).index, 1);
  assert.equal(segmentAt(t, -50).index, 0);
  assert.equal(segmentAt(t, 1e9).index, t.segments.length - 1);
  const mid = heightAt(t, 2.5 + 5 * 40);
  const a = t.segments[40].y, b = t.segments[41].y;
  assert.ok(Math.abs(mid - (a + b) / 2) < 1e-9);
});
