import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChores, workOnChore, findChoreInRange, CHORE_TYPES } from '../src/chores.js';
import { update } from '../src/game.js';
import { playing, NO_INPUT } from './helpers.js';

test('default day has 8 chores, 2 of each type', () => {
  const c = createChores({});
  assert.equal(c.length, 8);
  for (const t of Object.keys(CHORE_TYPES)) assert.equal(c.filter((x) => x.type === t).length, 2);
});

test('progress accumulates, persists, and completes once', () => {
  const [c] = createChores({});
  assert.equal(workOnChore(c, c.work / 2), false);
  assert.ok(Math.abs(c.progress - c.work / 2) < 1e-9);
  assert.equal(workOnChore(c, c.work), true);
  assert.equal(c.done, true);
  assert.equal(workOnChore(c, 1), false);
});

test('difficulty scales work time', () => {
  assert.ok(createChores({ difficulty: 'easy' })[0].work < createChores({ difficulty: 'hard' })[0].work);
});

test('range check picks nearest unfinished chore within 40px', () => {
  const cs = createChores({});
  assert.equal(findChoreInRange(cs, cs[0].x + 30, cs[0].y), cs[0]);
  assert.equal(findChoreInRange(cs, cs[0].x + 60, cs[0].y), null);
  cs[0].done = true;
  assert.equal(findChoreInRange(cs, cs[0].x, cs[0].y), null);
});

test('holding action in game works a chore; releasing keeps progress', () => {
  const s = playing({ wifeMode: 'random', questInterval: 300 });
  const c = s.chores[0];
  s.player.x = c.x; s.player.y = c.y;
  for (let i = 0; i < 60; i++) update(s, { ...NO_INPUT, action: true }, 1 / 60);
  assert.ok(Math.abs(c.progress - 1) < 0.02);
  for (let i = 0; i < 60; i++) update(s, NO_INPUT, 1 / 60);
  assert.ok(Math.abs(c.progress - 1) < 0.02);
});
