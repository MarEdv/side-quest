import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step } from '../src/game.js';
import { stepTraffic, targetCount, gapFree, populate } from '../src/traffic.js';
import { CFG } from '../src/config.js';
import { quiet, addCar, run, ofType } from './helpers.js';

const T = CFG.traffic;

test('a new drive has cars spread ahead, none closer than the start gap, all in lanes', () => {
  for (const road of ['highway', 'country']) for (let seed = 1; seed <= 5; seed++) {
    const s = createGame({ road }, seed);
    assert.ok(s.cars.length >= 3, `${road} ${seed}: ${s.cars.length}`);
    for (const c of s.cars) {
      assert.ok(c.z - s.player.z >= T.startMin, 'not in front of the player');
      assert.ok(['car', 'van', 'truck'].includes(c.kind));
      assert.ok(c.color >= 0 && c.color < T.palette.length);
      assert.ok(c.lane >= 0 && c.lane < s.track.lanes);
    }
  }
});

test('density rises per stage and with the difficulty', () => {
  const f = (difficulty, stage, road = 'highway') => {
    const track = { road, lanes: road === 'highway' ? 3 : 2 };
    let n = 0; for (let l = 0; l < track.lanes; l++) n += targetCount({ difficulty }, track, stage, l);
    return n;
  };
  for (const road of ['highway', 'country']) {
    assert.ok(f('normal', 0, road) < f('normal', 1, road) && f('normal', 1, road) < f('normal', 2, road), road);
    assert.ok(f('easy', 1, road) < f('normal', 1, road) && f('normal', 1, road) < f('hard', 1, road), road);
  }
});

test('spawning happens out of sight ahead, never inside or right in front of the player', () => {
  const s = createGame({ road: 'highway', steer: 'lanes' }, 3);
  const seen = new Set(s.cars.map((c) => c.id));
  let spawned = 0;
  for (let i = 0; i < 60 * 40; i++) {
    step(s, {});
    for (const c of s.cars) if (!seen.has(c.id)) {
      seen.add(c.id); spawned++;
      const d = c.z - s.player.z;
      assert.ok(d >= T.spawnMin - 5 || (d <= -T.behindMin + 5 && d >= -T.behindMax - 5), `spawned at ${d}`);
    }
    if (s.ended) break;
  }
  assert.ok(spawned >= 3, `spawned ${spawned}`);
});

test('despawns far behind and far ahead', () => {
  const s = quiet();
  addCar(s, { ahead: -(T.despawnBehind + 10), speed: 20 });
  addCar(s, { ahead: T.despawnAhead + 10, speed: 20 });
  const keep = addCar(s, { ahead: 100, speed: 25 });
  stepTraffic(s, CFG.dt);
  assert.deepEqual(s.cars.map((c) => c.id), [keep.id]);
});

test('a car follows a slower one ahead: brake lights on, speed matched, no rear-end', () => {
  const s = quiet();
  const slow = addCar(s, { ahead: 140, speed: 15 });
  const fast = addCar(s, { ahead: 20, speed: 26 });
  let braked = false, minGap = 1e9;
  for (let i = 0; i < 60 * 20; i++) {
    stepTraffic(s, CFG.dt);
    if (fast.braking) braked = true;
    minGap = Math.min(minGap, slow.z - fast.z - (slow.length + fast.length) / 2);
  }
  assert.ok(braked, 'brake lights');
  assert.ok(minGap > 3, `gap ${minGap}`);
  assert.ok(Math.abs(fast.speed - slow.speed) < 1, `${fast.speed} ${slow.speed}`);
});

test('cars brake for the player too', () => {
  const s = quiet();
  addCar(s, { ahead: -40, speed: 28, cruise: 28 });
  const c = s.cars[0];
  s.player.speed = 12;
  let braked = false;
  for (let i = 0; i < 60 * 3; i++) { s.player.z += 12 * CFG.dt; stepTraffic(s, CFG.dt); braked ||= c.braking; }
  assert.ok(braked && c.speed < 24, `${c.speed}`);
});

test('a lane change blinks for about 1.2 s before the car moves, then slides over in about 1.5 s', () => {
  const s = quiet();
  addCar(s, { lane: 1, ahead: 100, speed: 14 });
  const c = addCar(s, { lane: 1, ahead: 40, speed: 27, cooldown: 0 });
  s.rng = { chance: () => true, next: () => 0.5, range: (a) => a, int: (a) => a, pick: (a) => a[0] };
  let tBlink = null, tMove = null, tDone = null;
  const x0 = c.x;
  for (let i = 0; i < 60 * 10; i++) {
    s.time = i * CFG.dt; s.events = [];
    stepTraffic(s, CFG.dt);
    if (tBlink === null && c.blink !== 0) tBlink = s.time;
    if (tBlink !== null && tMove === null && Math.abs(c.x - x0) > 0.01) tMove = s.time;
    if (tMove !== null && c.blink === 0) { tDone = s.time; break; }
    if (tBlink === null) assert.equal(c.x, x0, 'no sideways move before the blinker');
  }
  assert.ok(tBlink !== null && tDone !== null && c.lane === 0, 'changed to the left lane');
  assert.ok(Math.abs(tMove - tBlink - T.blink) < 0.1, `blinked ${tMove - tBlink}`);
  assert.ok(Math.abs(tDone - tMove - T.slide) < 0.2, `slid ${tDone - tMove}`);
});

test('no lane change into an occupied gap (the player counts); a blink is cancelled when the gap closes', () => {
  const s = quiet();
  const c = addCar(s, { lane: 1, ahead: 0, speed: 20, cruise: 20 });
  s.player.z = 0; s.player.x = -3.6; // the player is in the left lane next to the car
  c.z = 0;
  assert.equal(gapFree(s, c, 0), false, 'the player blocks it');
  s.player.z = 60;
  assert.equal(gapFree(s, c, 0), true);
  const o = addCar(s, { lane: 0, ahead: 0, speed: 20 });
  o.z = c.z - 15; // just behind, too close
  assert.equal(gapFree(s, c, 0), false);
  o.z = c.z - 150; o.speed = 20;
  assert.equal(gapFree(s, c, 0), true);
  o.speed = 40; o.z = c.z - 40; // closing fast
  assert.equal(gapFree(s, c, 0), false);
  // a blink is cancelled at the end when the gap is gone
  c.blink = -1; c.blinkTimer = 0.01; c.targetLane = 0; o.z = c.z + 3; o.speed = 20;
  stepTraffic(s, 0.02);
  assert.equal(c.blink, 0);
  assert.equal(c.lane, 1);
  assert.equal(c.slide, false);
});

test('the country road has oncoming cars in the left lane and slow trucks in the player lane', () => {
  let oncoming = 0, trucks = 0, wrong = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const s = createGame({ road: 'country', length: 'short' }, seed);
    run(s, { gas: false }, 20);
    for (const c of s.cars) {
      if (c.lane === 0) { oncoming++; if (c.speed > 0) wrong++; } else { if (c.speed < 0) wrong++; if (c.kind === 'truck') trucks++; }
    }
  }
  assert.equal(wrong, 0);
  assert.ok(oncoming > 10, `oncoming ${oncoming}`);
  assert.ok(trucks >= 1, `trucks ${trucks}`);
  const s = createGame({ road: 'country' }, 1);
  for (let i = 0; i < 600; i++) { step(s, {}); assert.ok(s.cars.every((c) => c.blink === 0), 'no lane changes on the country road'); }
});

test('faster cars appear behind on the highway only, with room, and then overtake', () => {
  const s = createGame({ road: 'highway' }, 2);
  let behind = 0;
  const seen = new Set(s.cars.map((c) => c.id));
  for (let i = 0; i < 60 * 60 && !s.ended; i++) {
    step(s, {});
    for (const c of s.cars) if (!seen.has(c.id)) { seen.add(c.id); if (c.z < s.player.z) { behind++; assert.ok(c.speed > s.player.speed + 1); } }
  }
  assert.ok(behind >= 2, `behind ${behind}`);
  const k = createGame({ road: 'country' }, 2);
  for (let i = 0; i < 60 * 30; i++) { step(k, {}); assert.ok(k.cars.every((c) => c.z > k.player.z - 1 || c.cruise < 0 || c.z > k.player.z - 140)); }
});

test('populate and stepTraffic are deterministic for a seed', () => {
  const a = createGame({}, 9), b = createGame({}, 9);
  for (let i = 0; i < 900; i++) { step(a, {}); step(b, {}); }
  assert.deepEqual(a.cars, b.cars);
  assert.equal(typeof populate, 'function');
});
