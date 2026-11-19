import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/kit/rng.js';
import { createRoute, stepRoute, pickStations, eta, planStop, nextStation, legProgress, STATION_NAMES } from '../src/route.js';
import { CFG } from '../src/config.js';

const NO_SLIP = { slipChance: 0, slipMax: 10 };
const ALWAYS_SLIP = { slipChance: 1, slipMax: 10 };

function runUntil(route, rng, diff, pred, limit = 100000) {
  const seen = [];
  for (let i = 0; i < limit; i++) {
    const tr = stepRoute(route, CFG.dt, rng, diff);
    seen.push(...tr);
    if (pred(tr)) break;
  }
  return seen;
}

test('stations: 4 / 6 / 8 distinct fictional names, the same for a seed', () => {
  for (const [trip, n] of [['short', 4], ['normal', 6], ['long', 8]]) {
    const r = createRoute({ trip }, createRng(3));
    assert.equal(r.stations.length, n);
    assert.equal(new Set(r.stations).size, n);
    assert.equal(r.last, n - 1);
    for (const name of r.stations) assert.ok(STATION_NAMES.includes(name));
  }
  assert.deepEqual(pickStations(createRng(9), 5), pickStations(createRng(9), 5));
  assert.notDeepEqual(pickStations(createRng(9), 5), pickStations(createRng(10), 5));
});

test('a leg takes the trip\'s leg time, a dwell 8 s, and the trip ends at the last station', () => {
  for (const [trip, leg] of [['short', 45], ['normal', 60], ['long', 70]]) {
    const rng = createRng(1), route = createRoute({ trip }, rng);
    const seen = runUntil(route, rng, NO_SLIP, (tr) => tr.some((x) => x.type === 'arrive' && x.station === route.last));
    const arrivals = seen.filter((x) => x.type === 'arrive');
    assert.equal(arrivals.length, route.last);
    assert.deepEqual(arrivals.map((a) => a.station), [...Array(route.last).keys()].map((k) => k + 1));
    assert.equal(seen.filter((x) => x.type === 'depart').length, route.last);
  }
});

test('timing: the first departure is after 8 s, arrival one leg later', () => {
  const rng = createRng(1), route = createRoute({ trip: 'short' }, rng);
  let steps = 0;
  const count = (pred) => { for (;;) { steps++; if (pred(stepRoute(route, CFG.dt, rng, NO_SLIP))) return; } };
  count((tr) => tr.some((x) => x.type === 'depart'));
  assert.ok(Math.abs(steps * CFG.dt - 8) < 0.05, `departed at ${steps * CFG.dt}`);
  steps = 0;
  count((tr) => tr.some((x) => x.type === 'arrive'));
  assert.ok(Math.abs(steps * CFG.dt - 45) < 0.05, `arrived after ${steps * CFG.dt}`);
  assert.equal(route.phase, 'dwell');
  assert.equal(nextStation(route), 1);
});

test('a slip makes the leg longer and adds to the delay; a dwell wins back up to 5 s', () => {
  const rng = createRng(2), route = createRoute({ trip: 'short' }, rng);
  const seen = runUntil(route, rng, ALWAYS_SLIP, (tr) => tr.some((x) => x.type === 'slip'));
  const slip = seen.find((x) => x.type === 'slip').seconds;
  assert.ok(slip >= 5 && slip <= 10);
  assert.equal(route.delay, slip);
  assert.equal(route.legDur, 45 + slip);
  // next departure: delay - 5 (never below 0), then a new slip
  runUntil(route, createRng(7), NO_SLIP, (tr) => tr.some((x) => x.type === 'depart'));
  assert.equal(route.delay, Math.max(0, slip - 5));
  route.delay = 3;
  const r2 = createRng(1);
  route.phase = 'dwell'; route.timer = CFG.dwell - 0.001;
  stepRoute(route, CFG.dt, r2, NO_SLIP);
  assert.equal(route.delay, 0);
});

test('a planned rescue stop halts the leg for 10 s in the middle and adds 20 s of delay', () => {
  const rng = createRng(1), route = createRoute({ trip: 'short' }, rng);
  planStop(route, 0);
  const seen = [];
  let legTime = 0;
  for (let i = 0; i < 100000; i++) {
    const wasLeg = route.phase === 'leg';
    const tr = stepRoute(route, CFG.dt, rng, NO_SLIP);
    seen.push(...tr);
    if (wasLeg && route.phase === 'leg') legTime += CFG.dt;
    if (tr.some((x) => x.type === 'arrive')) break;
  }
  const kinds = seen.map((x) => x.type);
  assert.deepEqual(kinds, ['depart', 'stopStart', 'stopEnd', 'arrive']);
  assert.equal(route.delay, 20);
  assert.equal(route.stop, null, 'a finished stop is cleared so another can be planned');
  assert.ok(Math.abs(legTime - 45) < 0.1, `moving time ${legTime}`);
});

test('a planned stop that is no longer possible is called off: no stop, no delay, the plan is cleared', () => {
  const rng = createRng(1), route = createRoute({ trip: 'short' }, rng);
  planStop(route, 0);
  const seen = [];
  for (let i = 0; i < 100000; i++) {
    const tr = stepRoute(route, CFG.dt, rng, NO_SLIP, () => false);
    seen.push(...tr.map((x) => x.type));
    assert.notEqual(route.phase, 'stop');
    if (tr.some((x) => x.type === 'arrive')) break;
  }
  assert.deepEqual(seen, ['depart', 'stopCancel', 'arrive']);
  assert.equal(route.delay, 0); assert.equal(route.stop, null);
});

test('eta counts legs, dwells and a pending stop', () => {
  const rng = createRng(1), route = createRoute({ trip: 'normal' }, rng);
  assert.equal(eta(route, 0), 0);
  assert.equal(eta(route, 1), 8 + 60);
  assert.equal(eta(route, 3), 8 + 60 + (8 + 60) * 2);
  planStop(route, 1);
  assert.equal(eta(route, 2), 8 + 60 + 8 + 60 + 10);
  assert.equal(eta(route, 1), 8 + 60);
  runUntil(route, rng, NO_SLIP, (tr) => tr.some((x) => x.type === 'depart'));
  route.timer = 20;
  assert.ok(Math.abs(eta(route, 1) - 40) < 1e-9);
  assert.equal(legProgress(route), 20 / 60);
});
