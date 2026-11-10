import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, update, moveCircle, findPath, clockString, addPooTask, spawnTask } from '../src/game.js';
import { STATIONS, OBSTACLES } from '../src/world.js';
import { CONFIG as C } from '../src/config.js';

const quiet = (s) => { s.boss.throwT = 1e9; s.spawnT = 1e9; return s; };
const types = (s) => s.events.map((e) => e.type);

test('collision: player cannot enter or tunnel through a desk and slides along it', () => {
  const desk = OBSTACLES.find((o) => o.own);
  // approach desk top from above, moving diagonally
  const x0 = desk.x + 20, y0 = desk.y - 30;
  let p = { x: x0, y: y0 };
  for (let i = 0; i < 14; i++) p = moveCircle(p.x, p.y, 3, 3, 12);
  assert.ok(p.y <= desk.y - 12 + 1e-6, 'stopped above desk');
  assert.ok(p.x > x0 + 20, 'slid sideways');
});

test('collision: world walls contain the player', () => {
  const s = quiet(createGame({}, 1));
  s.player.x = 30; s.player.y = 30;
  for (let i = 0; i < 100; i++) update(s, 0.016, { moveX: -1, moveY: -1 });
  assert.ok(s.player.x >= 16 + 12 - 1e-6 && s.player.y >= 16 + 12 - 1e-6);
});

test('pathfinding routes around obstacles', () => {
  const path = findPath({ x: 185, y: 370 }, { x: 150, y: 138 });
  assert.ok(path && path.length > 3);
});

test('tap-to-move reaches a target', () => {
  const s = quiet(createGame({}, 1));
  const st = STATIONS.coffee;
  for (let i = 0; i < 60 * 15; i++) update(s, 1 / 60, { target: { id: 1, x: st.x, y: st.y } });
  assert.ok(Math.hypot(s.player.x - st.x, s.player.y - st.y) < st.r);
});

test('task completes by holding in the station zone', () => {
  const s = quiet(createGame({}, 1));
  const t = spawnTask(s);
  const st = STATIONS[t.station];
  s.player.x = st.x; s.player.y = st.y;
  const stress0 = s.stress;
  for (let i = 0; i < Math.ceil((t.hold + 0.2) * 60); i++) update(s, 1 / 60, {});
  assert.equal(s.tasks.length, 0);
  assert.equal(s.score, C.tasks.points);
  assert.ok(s.stress < stress0);
});

test('task does not progress outside the zone', () => {
  const s = quiet(createGame({}, 1));
  const t = spawnTask(s);
  s.player.x = 480; s.player.y = 370;
  for (let i = 0; i < 300; i++) update(s, 1 / 60, {});
  assert.equal(t.progress, 0);
});

test('max active regular tasks, overflow adds stress', () => {
  const s = quiet(createGame({}, 1));
  for (let i = 0; i < C.tasks.maxActive; i++) assert.ok(spawnTask(s));
  const st = s.stress;
  assert.equal(spawnTask(s), null);
  assert.ok(s.stress > st);
});

function aimedThrow(s) {
  s.boss.x = 400; s.boss.y = 372; s.boss.throwT = 0; s.boss.pause = 99;
  s.player.x = 600; s.player.y = 372;
  const evs = [];
  for (let i = 0; i < 400 && !evs.includes('hit'); i++) { update(s, 1 / 60, {}); evs.push(...types(s)); }
  return evs;
}

test('boss winds up before throwing, projectile hit creates a poo task (hit mode)', () => {
  const s = createGame({ poo: 'hit' }, 7);
  s.spawnT = 1e9;
  const evs = aimedThrow(s);
  assert.ok(evs.indexOf('windup') >= 0 && evs.indexOf('windup') < evs.indexOf('throw'));
  assert.ok(evs.includes('hit'));
  const poo = s.tasks.filter((t) => t.kind === 'poo');
  assert.equal(poo.length, 1);
  assert.ok(s.stress > 10);
  assert.equal(poo[0].accepted, false);
});

test('dodged sandwich splats; hit mode leaves no pickup', () => {
  const s = createGame({ poo: 'hit' }, 7);
  s.spawnT = 1e9; s.boss.x = 400; s.boss.y = 372; s.boss.throwT = 0; s.boss.pause = 99;
  s.player.x = 600; s.player.y = 372;
  for (let i = 0; i < 40; i++) update(s, 1 / 60, {});
  s.player.x = 600; s.player.y = 470; // step out of the way
  for (let i = 0; i < 200; i++) update(s, 1 / 60, {});
  assert.equal(s.tasks.filter((t) => t.kind === 'poo').length, 0);
  assert.equal(s.splats.filter((x) => x.pickup).length, 0);
});

test('choice mode: landed sandwich can be picked up for a bigger reward', () => {
  const s = createGame({ poo: 'choice' }, 3);
  s.spawnT = 1e9;
  s.splats.push({ id: 99, x: 480, y: 372, age: 0, life: C.poo.floorLife, pickup: true, r: 16 });
  s.player.x = 480; s.player.y = 372;
  update(s, 1 / 60, {});
  const poo = s.tasks.find((t) => t.kind === 'poo');
  assert.ok(poo && poo.accepted);
  assert.equal(poo.points, C.poo.choicePoints);
  assert.equal(poo.timeLeft, poo.deadline - 0 > 0 ? poo.timeLeft : 0);
  assert.equal(s.splats.length, 0);
});

test('choice mode: ignoring a sandwich adds a little stress', () => {
  const s = quiet(createGame({ poo: 'choice' }, 3));
  s.splats.push({ id: 99, x: 480, y: 480, age: 0, life: 1, pickup: true, r: 16 });
  const st = s.stress;
  for (let i = 0; i < 90; i++) update(s, 1 / 60, {});
  assert.equal(s.splats.length, 0);
  assert.ok(Math.abs(s.stress - st - C.poo.ignoreStress) < 0.01);
  assert.equal(s.tasks.length, 0);
});

test('poo task solved at its station scores more; expired poo task adds big stress', () => {
  const s = quiet(createGame({}, 5));
  const t = addPooTask(s);
  const st = STATIONS[t.station];
  s.player.x = st.x; s.player.y = st.y;
  for (let i = 0; i < Math.ceil((t.hold + 0.3) * 60); i++) update(s, 1 / 60, {});
  assert.equal(s.score, C.poo.points);
  assert.equal(s.stats.pooDone, 1);

  const s2 = quiet(createGame({}, 5));
  addPooTask(s2);
  s2.player.x = 480; s2.player.y = 372;
  const before = s2.stress;
  for (let i = 0; i < (C.poo.deadline + 1) * 60 && !s2.events.some((e) => e.type === 'pooExpired'); i++) update(s2, 1 / 60, {});
  assert.ok(s2.stress >= before + C.poo.expireStress - 1);
  assert.equal(s2.tasks.length, 0);
});

test('stress reaching 100 ends the game (burnout)', () => {
  const s = quiet(createGame({}, 1));
  s.stress = 99.9;
  addPooTask(s);
  s.tasks[0].timeLeft = 0.01;
  s.player.x = 480; s.player.y = 372;
  update(s, 0.05, {});
  assert.equal(s.phase, 'lost');
  assert.equal(s.summary.won, false);
  // frozen afterwards
  const t = s.t; update(s, 0.05, {}); assert.equal(s.t, t);
});

test('clock reaching 17:00 wins and awards low-stress bonus', () => {
  const s = quiet(createGame({ daySeconds: 10 }, 1));
  assert.equal(clockString(s), '09:00');
  s.stress = 20;
  for (let i = 0; i < 1000 && s.phase === 'playing'; i++) { s.stress = 20; update(s, 0.05, {}); }
  assert.equal(s.phase, 'won');
  assert.equal(clockString(s), '17:00');
  assert.equal(s.summary.bonus, 800);
  assert.ok(s.score >= 800);
});

test('deterministic with the same seed', () => {
  const run = () => { const s = createGame({ daySeconds: 30 }, 42); for (let i = 0; i < 600; i++) update(s, 1 / 60, { moveX: 0.3, moveY: 0 }); return [s.stress, s.score, s.tasks.length, s.projectiles.length, s.boss.x]; };
  assert.deepEqual(run(), run());
});

test('difficulty ramps: sandwiches get faster, throws more frequent', async () => {
  const { throwInterval, sandwichSpeed } = await import('../src/game.js');
  assert.ok(throwInterval(1) < throwInterval(0));
  assert.ok(sandwichSpeed(1) > sandwichSpeed(0));
});
