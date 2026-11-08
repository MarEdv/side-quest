import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, update, computeScore } from '../src/game.js';
import { giveQuest } from '../src/quests.js';
import { playing, NO_INPUT, mkFlags } from './helpers.js';

const quiet = { wifeMode: 'random', questInterval: 300 };

test('title -> playing on start edge; pause toggles on edges only', () => {
  const s = createGame(mkFlags(), 'title');
  update(s, NO_INPUT, 1 / 60);
  assert.equal(s.phase, 'title');
  update(s, { ...NO_INPUT, start: true }, 1 / 60);
  assert.equal(s.phase, 'playing');
  update(s, { ...NO_INPUT, pause: true }, 1 / 60);
  assert.equal(s.phase, 'paused');
  update(s, { ...NO_INPUT, pause: true }, 1 / 60); // still held: no re-toggle
  assert.equal(s.phase, 'paused');
  update(s, NO_INPUT, 1 / 60);
  update(s, { ...NO_INPUT, pause: true }, 1 / 60);
  assert.equal(s.phase, 'playing');
});

test('paused game does not advance time', () => {
  const s = playing(quiet);
  update(s, { ...NO_INPUT, pause: true }, 1 / 60);
  const t = s.time;
  for (let i = 0; i < 30; i++) update(s, NO_INPUT, 1 / 60);
  assert.equal(s.time, t);
});

test('win: finishing the last chore before sunset', () => {
  const s = playing(quiet);
  for (const c of s.chores) c.progress = c.work - 0.001, (c.done = c !== s.chores[7]);
  s.chores[7].done = false;
  s.player.x = s.chores[7].x; s.player.y = s.chores[7].y;
  update(s, { ...NO_INPUT, action: true }, 1 / 60);
  assert.equal(s.phase, 'won');
  assert.equal(s.endReason, 'win');
  assert.ok(s.score >= 500);
  assert.ok(s.events.some((e) => e.type === 'won'));
});

test('lose: sunset with chores left', () => {
  const s = playing({ ...quiet, dayLength: 10 });
  for (let i = 0; i < 60 * 11 && s.phase === 'playing'; i++) update(s, NO_INPUT, 1 / 60);
  assert.equal(s.phase, 'lost');
  assert.equal(s.endReason, 'sunset');
});

test('lose: harmony reaches 0', () => {
  const s = playing(quiet);
  s.harmony = 5;
  const q = giveQuest(s);
  q.timeLeft = 0.01;
  update(s, NO_INPUT, 1 / 60);
  assert.equal(s.harmony, 0);
  assert.equal(s.phase, 'lost');
  assert.equal(s.endReason, 'harmony');
});

test('restart from end screen starts a fresh day', () => {
  const s = playing({ ...quiet, dayLength: 10 });
  for (let i = 0; i < 60 * 11; i++) update(s, NO_INPUT, 1 / 60);
  assert.equal(s.phase, 'lost');
  update(s, { ...NO_INPUT, restart: true }, 1 / 60);
  assert.equal(s.phase, 'playing');
  assert.equal(s.time, 0);
  assert.equal(s.harmony, 60);
  assert.ok(s.chores.every((c) => !c.done));
});

function script(i) {
  return { ...NO_INPUT, right: i % 200 < 100, down: i % 300 < 150, left: i % 200 >= 100, up: i % 300 >= 150, action: i % 7 < 4 };
}
function run(seed, flags = {}) {
  const s = playing({ seed, ...flags });
  for (let i = 0; i < 60 * 120; i++) update(s, script(i), 1 / 60);
  return JSON.stringify(s);
}

test('deterministic: same seed -> identical state; different seed differs', () => {
  assert.equal(run(9), run(9));
  assert.equal(run(9, { wifeMode: 'random' }), run(9, { wifeMode: 'random' }));
  assert.notEqual(run(9), run(10));
});

test('score formula', () => {
  const s = playing(quiet);
  s.chores[0].done = true;
  s.stats = { questsCompleted: 1, questsFailed: 1, questsAvoided: 2 };
  assert.equal(computeScore(s), Math.round(100 + 50 + 50 - 40 + 60));
});
