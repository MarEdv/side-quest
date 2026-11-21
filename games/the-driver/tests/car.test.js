import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, updatePlayer, nextSpeed } from '../src/car.js';
import { createTrack, laneX } from '../src/track.js';
import { CFG } from '../src/config.js';

const DT = CFG.dt;
const flat = (road = 'highway', length = 'short') => {
  const t = createTrack(1, { road, length });
  for (const s of t.segments) { s.curve = 0; s.y = 0; }
  return t;
};
const run = (p, track, flags, input, secs) => {
  for (let i = 0; i < Math.round(secs / DT); i++) updatePlayer(p, track, flags, typeof input === 'function' ? input(i) : input, DT);
};
const AUTO = { pedals: 'auto', steer: 'free' };

test('the player starts in the middle lane at cruising speed', () => {
  const p = createPlayer(flat());
  assert.equal(p.x, 0); assert.equal(p.z, 0); assert.ok(Math.abs(p.speed * 3.6 - 110.16) < 0.01);
  assert.equal(p.crashTimer, 0); assert.equal(p.offroad, false);
  assert.equal(createPlayer(flat('country')).x, 1.8);
});

test('pedals=auto: cruises at 110 km/h by itself, gas goes up to 180, brake slows down, letting go falls back to cruise', () => {
  const t = flat(), p = createPlayer(t);
  p.speed = 10;
  run(p, t, AUTO, {}, 8);
  assert.ok(Math.abs(p.speed - CFG.player.cruise) < 1e-9);
  run(p, t, AUTO, { gas: true }, 10);
  assert.equal(p.speed, 50);
  assert.equal(p.topSpeed, 50);
  run(p, t, AUTO, {}, 10);
  assert.ok(Math.abs(p.speed - CFG.player.cruise) < 1e-9);
  run(p, t, AUTO, { brake: true }, 1);
  assert.ok(p.speed < 10 && p.speed > 5, `${p.speed}`);
  run(p, t, AUTO, { brake: true, gas: true }, 5);
  assert.equal(p.speed, 0, 'brake wins over gas and stops at 0');
  assert.equal(p.topSpeed, 50, 'the top speed is kept');
});

test('pedals=manual: nothing without gas, coasting down, brake slows faster', () => {
  const flags = { pedals: 'manual', steer: 'free' };
  assert.ok(nextSpeed(30, flags, {}, DT) < 30);
  assert.ok(nextSpeed(30, flags, { gas: true }, DT) > 30);
  assert.ok(nextSpeed(30, flags, { brake: true }, DT) < nextSpeed(30, flags, {}, DT));
  assert.equal(nextSpeed(0, flags, {}, DT), 0);
  const t = flat(), p = createPlayer(t);
  p.speed = 0;
  run(p, t, flags, {}, 3);
  assert.equal(p.speed, 0, 'standing still stays still');
  run(p, t, flags, { gas: true }, 20);
  assert.equal(p.speed, 50);
  run(p, t, flags, {}, 5);
  assert.ok(p.speed < 45 && p.speed > 30, `${p.speed}`);
});

test('free steering: lateral speed grows with speed, the wheel follows smoothly and returns to centre', () => {
  const t = flat();
  const slow = createPlayer(t), fast = createPlayer(t);
  slow.speed = 10; fast.speed = 40;
  run(slow, t, { pedals: 'manual', steer: 'free' }, { right: true }, 0.5);
  run(fast, t, AUTO, { right: true, gas: true }, 0.5);
  assert.ok(fast.x > slow.x * 2 && slow.x > 0, `${slow.x} ${fast.x}`);
  assert.ok(fast.steer > 0.99 && fast.steer <= 1);
  run(fast, t, AUTO, { left: true }, 0.05);
  assert.ok(fast.steer < 1 && fast.steer > -1);
  run(fast, t, AUTO, {}, 1);
  assert.ok(Math.abs(fast.steer) < 1e-9);
  const left = createPlayer(t);
  run(left, t, AUTO, { left: true }, 0.5);
  assert.ok(left.x < 0);
});

test('centrifugal drift pushes outward in proportion to speed squared times curvature', () => {
  const t = flat();
  for (const s of t.segments) s.curve = 0.5; // a right curve
  const a = createPlayer(t), b = createPlayer(t), c = createPlayer(t);
  a.speed = 20; b.speed = 40; c.speed = 20;
  const man = { pedals: 'manual', steer: 'free' };
  run(a, t, man, { gas: true }, 0); // no time: nothing moves
  const step = (p, speed) => { p.speed = speed; const x0 = p.x; updatePlayer(p, t, { pedals: 'auto', steer: 'free' }, { gas: true, brake: false }, DT); return p.x - x0; };
  const d20 = step(a, 20), d40 = step(b, 40);
  assert.ok(d20 < 0, 'a right curve pushes the car left (outward)');
  assert.ok(Math.abs(d40 / d20 - 4) < 0.2, `ratio ${d40 / d20}`);
  for (const s of t.segments) s.curve = -0.5;
  assert.ok(step(c, 20) > 0, 'a left curve pushes right');
  // steering against it holds the car: 30 m/s on curve 0.5: drift 3.0 m/s, steer 0.4 cancels it
  const t2 = flat(); for (const s of t2.segments) s.curve = 0.5;
  const h = createPlayer(t2);
  run(h, t2, AUTO, () => ({ right: h.x < -0.3, left: h.x > 0.3 }), 6);
  assert.ok(Math.abs(h.x) < 1, `holds with correction: ${h.x}`);
  const free = createPlayer(t2);
  run(free, t2, AUTO, {}, 6);
  assert.ok(free.x < -3, `uncorrected it drifts out: ${free.x}`);
});

test('the barriers (halfWidth + 2.5 m) stop the car with its side against them, and it is not a crash', () => {
  const t = flat(), p = createPlayer(t);
  run(p, t, AUTO, { right: true }, 6);
  assert.equal(p.x, t.halfWidth + 2.5 - p.width / 2);
  assert.equal(p.barrier, true);
  assert.equal(p.crashTimer, 0);
  const q = createPlayer(t);
  run(q, t, AUTO, { left: true }, 6);
  assert.equal(q.x, -(t.halfWidth + 2.5 - q.width / 2));
});

test('off the asphalt the speed is capped at 60 km/h and offroad is set', () => {
  const t = flat(), p = createPlayer(t);
  p.speed = 40;
  run(p, t, AUTO, { right: true }, 1.6); // across the 5.4 m edge
  assert.equal(p.offroad, true);
  run(p, t, AUTO, { right: true, gas: true }, 3);
  assert.ok(p.speed <= CFG.player.grassCap + 1e-9, `${p.speed}`);
  assert.ok(p.speed > 15);
  run(p, t, AUTO, { left: true, gas: true }, 0.9);
  assert.equal(p.offroad, false);
  run(p, t, AUTO, { gas: true }, 4);
  assert.ok(p.speed > 30, 'back on the road it accelerates again');
});

test('lanes steering: a tap moves one lane over, edges at the sides do nothing, no drift in curves', () => {
  const t = flat();
  for (const s of t.segments) s.curve = 0.9;
  const flags = { pedals: 'auto', steer: 'lanes' };
  const p = createPlayer(t);
  run(p, t, flags, (i) => ({ rightPressed: i === 0 }), 1);
  assert.equal(p.laneTarget, 2);
  assert.ok(Math.abs(p.x - 3.6) < 0.01, `${p.x}`);
  run(p, t, flags, (i) => ({ rightPressed: i === 0 }), 1);
  assert.equal(p.laneTarget, 2, 'no lane to the right');
  run(p, t, flags, { leftPressed: true }, DT);
  run(p, t, flags, {}, 1);
  assert.equal(p.laneTarget, 1);
  assert.ok(Math.abs(p.x) < 0.01);
  run(p, t, flags, {}, 2);
  assert.ok(Math.abs(p.x) < 0.01, 'curves do not push in lanes mode');
  assert.ok(Math.abs(laneX(t, p.laneTarget) - p.x) < 0.01);
});

test('a crash locks the steering until the timer is out', () => {
  const t = flat(), p = createPlayer(t);
  p.crashTimer = 1;
  run(p, t, AUTO, { right: true }, 0.5);
  assert.equal(p.x, 0);
  assert.ok(p.crashTimer > 0.4 && p.crashTimer < 0.6);
  run(p, t, AUTO, { right: true }, 1);
  assert.ok(p.x > 0);
  const q = createPlayer(t);
  q.crashTimer = 1;
  run(q, t, { pedals: 'auto', steer: 'lanes' }, { rightPressed: true }, 0.5);
  assert.equal(q.laneTarget, 1);
});
