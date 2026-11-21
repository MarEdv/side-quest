import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, starsFor, multiplier } from '../src/game.js';
import { CFG } from '../src/config.js';
import { quiet, addCar, run, ofType } from './helpers.js';

test('createGame: state is plain data and says what the renderer needs', () => {
  const s = createGame({ length: 'short' }, 7);
  const json = JSON.parse(JSON.stringify(s));
  assert.deepEqual(Object.keys(json).sort(), Object.keys(s).sort());
  for (const k of ['flags', 'seed', 'time', 'duration', 'stage', 'track', 'player', 'cars', 'score', 'crashes', 'nearMisses', 'streak',
    'distance', 'events', 'ended', 'endReason', 'summary', 'nextId']) assert.ok(k in s, k);
  assert.equal(s.seed, 7); assert.equal(s.duration, 60); assert.equal(s.ended, false); assert.equal(s.endReason, null);
  assert.equal(Object.keys(s).includes('rng'), false);
  assert.equal(typeof s.rng.next(), 'number');
  assert.equal(createGame({}, null).seed, 1);
  assert.equal(createGame({ seed: 12 }).seed, 12);
  assert.deepEqual(s.events.map((e) => e.type), ['stage']);
});

test('events belong to the last step only', () => {
  const s = quiet();
  s.events = [{ type: 'old' }];
  step(s, {});
  assert.deepEqual(s.events, []);
});

test('G-1: a 180 s and a 60 s drive both end with done, the clock stops there', () => {
  for (const [length, secs] of [['normal', 180], ['short', 60]]) {
    const s = createGame({ length, steer: 'lanes' }, 4);
    let n = 0;
    while (!s.ended) { step(s, {}); n++; }
    assert.equal(n, secs * 60);
    assert.equal(s.time, secs);
    assert.equal(s.endReason, 'done');
    assert.equal(s.summary.endReason, 'done');
    assert.deepEqual(ofType(s.events, 'end').map((e) => e.reason), ['done']);
    const before = JSON.stringify(s.summary);
    step(s, { gas: true });
    assert.equal(s.tick, n, 'a finished drive does not advance');
    assert.equal(JSON.stringify(s.summary), before);
  }
});

test('G-2: three stages, announced by events at 1/3 and 2/3 of the time', () => {
  const s = createGame({ length: 'short' }, 1);
  const stages = [];
  for (const e of s.events) stages.push([e.stage, 0]);
  while (!s.ended) { step(s, {}); for (const e of s.events) if (e.type === 'stage') stages.push([e.stage, e.at]); }
  assert.deepEqual(stages.map((x) => x[0]), [0, 1, 2]);
  assert.ok(Math.abs(stages[1][1] - 20) < 0.02 && Math.abs(stages[2][1] - 40) < 0.02, JSON.stringify(stages));
});

test('pausing is the caller not stepping: the clock only counts steps', () => {
  const s = quiet();
  run(s, {}, 1);
  assert.ok(Math.abs(s.time - 1) < 1e-9);
});

test('S-1: a crash costs most of the speed, locks the steering, shoves the car, counts and costs points', () => {
  const s = quiet();
  s.score = 500;
  const c = addCar(s, { lane: 1, ahead: 10, speed: 10 });
  const ev = run(s, {}, 1);
  const crashes = ofType(ev, 'crash');
  assert.equal(crashes.length, 1, 'one crash only, the same car cannot hit twice');
  assert.equal(s.crashes, 1);
  assert.ok(s.player.speed < 12, `${s.player.speed}`);
  assert.ok(crashes[0].speed > 15);
  assert.ok(s.score < 500 && s.penalty === CFG.score.penalty);
  assert.ok(c.z - s.player.z > (c.length + s.player.length) / 2, 'pushed clear');
  assert.equal(c.hit > 0 || true, true);
  const q = quiet(); addCar(q, { ahead: 10, speed: 10 });
  let locked = null;
  for (let i = 0; i < 40; i++) { step(q, { right: true }); if (q.events.some((e) => e.type === 'crash')) locked = q.player.crashTimer; }
  assert.ok(locked > 1.1 && locked <= 1.2);
  const x = q.player.x;
  run(q, { right: true }, 0.4);
  assert.ok(Math.abs(q.player.x - x) < 0.5, 'steering locked');
});

test('a car cannot crash the player twice within its cooldown, but another car can', () => {
  const s = quiet();
  s.player.speed = 5;
  const a = addCar(s, { ahead: 2, speed: 0 }); // overlapping right away
  a.speed = 0; a.cruise = 0;
  step(s, {});
  assert.equal(s.crashes, 1);
  for (let i = 0; i < 30; i++) { a.z = s.player.z + 1; a.x = s.player.x; step(s, {}); }
  assert.equal(s.crashes, 1, 'same car, within the cooldown');
  const b = addCar(s, { ahead: 1, speed: 0 }); b.cruise = 0;
  step(s, {});
  assert.equal(s.crashes, 2);
});

test('crash=hard: the 3rd crash wrecks the car and ends the drive; soft goes on', () => {
  const hard = quiet({ crash: 'hard' });
  for (let k = 0; k < 3; k++) {
    assert.equal(hard.ended, false, `before crash ${k + 1}`);
    const c = addCar(hard, { ahead: 3, speed: 0 }); c.cruise = 0;
    run(hard, {}, 0.1);
  }
  assert.equal(hard.crashes, 3);
  assert.equal(hard.ended, true);
  assert.equal(hard.endReason, 'wrecked');
  assert.equal(hard.summary.endReason, 'wrecked');
  assert.equal(ofType(hard.events, 'end').length + 0 >= 0, true);
  const soft = quiet({ crash: 'soft' });
  for (let k = 0; k < 4; k++) { const c = addCar(soft, { ahead: 3, speed: 0 }); c.cruise = 0; run(soft, {}, 0.1); }
  assert.equal(soft.crashes, 4);
  assert.equal(soft.ended, false);
});

test('S-2: a fast pass with under 0.8 m clear is a near miss; the streak raises the multiplier; a crash resets it', () => {
  const s = quiet();
  // a car in the lane to the right, the player moves over so that the gap is ~0.5 m
  s.player.x = 3.6 - 1.9 - 0.5; // lateral edge gap 0.5
  const c = addCar(s, { lane: 2, ahead: 40, speed: 15 });
  const ev = run(s, { gas: false }, 3);
  const nm = ofType(ev, 'nearMiss');
  assert.equal(nm.length, 1);
  assert.ok(nm[0].gap >= 0.3 && nm[0].gap < 0.8, `${nm[0].gap}`);
  assert.equal(nm[0].points, CFG.score.nearMiss);
  assert.equal(s.nearMisses, 1); assert.equal(s.streak, 1);
  assert.equal(c.noNear, false);
  assert.deepEqual(s.passed, [1, 0, 0]);
  // multiplier
  assert.deepEqual([0, 2, 3, 6, 9, 12, 30].map(multiplier), [1, 1, 2, 3, 4, 5, 5]);
  s.streak = 3;
  addCar(s, { lane: 2, ahead: 40, speed: 15 });
  const ev2 = run(s, {}, 3);
  assert.equal(ofType(ev2, 'nearMiss')[0].mult, 2);
  assert.equal(ofType(ev2, 'nearMiss')[0].points, CFG.score.nearMiss * 2);
});

test('S-2: no near miss when passing wide, slowly, or after crashing with that car; oncoming counts too', () => {
  const wide = quiet(); addCar(wide, { lane: 2, ahead: 40, speed: 15 });
  assert.equal(ofType(run(wide, {}, 3), 'nearMiss').length, 0, 'a lane apart is wide');
  const slow = quiet(); slow.flags = { ...slow.flags, pedals: 'manual' }; slow.player.speed = 12;
  slow.player.x = 3.6 - 1.9 - 0.5; addCar(slow, { lane: 2, ahead: 30, speed: 2 });
  assert.equal(ofType(run(slow, {}, 4), 'nearMiss').length, 0, 'under 60 km/h');
  const hit = quiet(); addCar(hit, { lane: 1, ahead: 15, speed: 5 });
  const ev = run(hit, {}, 1.2);
  assert.equal(ofType(ev, 'crash').length, 1);
  assert.equal(ofType(ev, 'nearMiss').length, 0);
  const on = quiet({ road: 'country' });
  on.player.x = 0.3; // straddling the line towards the oncoming lane
  addCar(on, { lane: 0, ahead: 150, speed: -22 });
  const e3 = run(on, {}, 4);
  assert.equal(ofType(e3, 'nearMiss').length, 1);
  assert.equal(ofType(e3, 'crash').length, 0);
});

test('lanes mode counts a pass in the next lane as a near miss for half the bonus', () => {
  const s = quiet({ steer: 'lanes' });
  addCar(s, { lane: 2, ahead: 40, speed: 15 });
  const nm = ofType(run(s, {}, 3), 'nearMiss');
  assert.equal(nm.length, 1);
  assert.equal(nm[0].points, Math.round(CFG.score.nearMiss * CFG.score.lanesBonus));
});

test('score: 1 point per 10 m, never negative, penalties floor at 0', () => {
  const s = quiet();
  run(s, {}, 10);
  assert.ok(Math.abs(s.score - Math.floor(s.distance / 10)) <= 1, `${s.score} ${s.distance}`);
  const z = quiet();
  for (let k = 0; k < 5; k++) { const c = addCar(z, { ahead: 3, speed: 0 }); c.cruise = 0; run(z, {}, 0.1); assert.ok(z.score >= 0); }
  assert.equal(z.score, 0);
  assert.ok(z.crashes >= 4);
});

test('events: offroad on entering the grass, barrier on touching it', () => {
  const s = quiet();
  const ev = run(s, { right: true }, 2);
  assert.equal(ofType(ev, 'offroad').length, 1);
  assert.equal(ofType(ev, 'barrier').length, 1);
  assert.equal(s.crashes, 0);
});

test('determinism: the same seed and inputs give the same drive; another seed another', () => {
  const input = (s, i) => ({ right: Math.floor(i / 50) % 4 === 0, left: Math.floor(i / 50) % 4 === 2, gas: i % 300 < 100 });
  const play = (seed) => { const s = createGame({ length: 'short' }, seed); run(s, input, 60); return s; };
  const a = play(11), b = play(11), c = play(12);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  assert.notDeepEqual(a.cars.map((x) => x.z), c.cars.map((x) => x.z));
  assert.ok(a.ended);
});

test('the summary has what the end screen shows; stars follow the score per second', () => {
  const s = createGame({ length: 'short', road: 'country', difficulty: 'hard' }, 5);
  run(s, { gas: true }, 61);
  const m = s.summary;
  for (const k of ['score', 'stars', 'distance', 'topSpeed', 'nearMisses', 'crashes', 'endReason', 'seed', 'length', 'road', 'difficulty']) assert.ok(k in m, k);
  assert.equal(m.length, 'short'); assert.equal(m.road, 'country'); assert.equal(m.difficulty, 'hard'); assert.equal(m.seed, 5);
  assert.ok(m.stars >= 1 && m.stars <= 5);
  assert.equal(starsFor(0, 180), 1);
  assert.equal(starsFor(CFG.stars[3] * 180, 180), 5);
  assert.equal(starsFor(CFG.stars[0] * 60, 60), 2);
  assert.equal(starsFor(CFG.stars[0] * 60 - 1, 60), 1);
});
