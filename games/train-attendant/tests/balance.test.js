import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step } from '../src/game.js';
import { createBot, BOT_KINDS } from '../tools/bots.mjs';

// A small version of tools/sim.mjs: short trips, a few seeds (the full table is in docs/DECISIONS.md).
function play(flags, seed, kind) {
  const s = createGame(flags, seed), bot = createBot(kind, seed);
  while (!s.ended) step(s, bot(s));
  return s.summary;
}
const stars = (kind, flags) => [1, 2, 3, 4].map((seed) => play(flags, seed, kind).stars);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

test('the bots: idle play gets 1 star, good play 4-5, sloppy play in between', () => {
  assert.deepEqual(BOT_KINDS, ['idle', 'sloppy', 'good']);
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const flags = { trip: 'short', difficulty };
    assert.deepEqual(stars('idle', flags), [1, 1, 1, 1], `idle ${difficulty}`);
    const good = mean(stars('good', flags)), sloppy = mean(stars('sloppy', flags));
    assert.ok(good >= 4, `good ${difficulty}: ${good}`);
    assert.ok(sloppy >= 1.5 && sloppy < good, `sloppy ${difficulty}: ${sloppy}`);
  }
});

test('a good bot on a normal trip gets no or hardly any complaints and completes quests', () => {
  const runs = [1, 2, 3].map((seed) => play({ trip: 'normal' }, seed, 'good'));
  assert.ok(Math.max(...runs.map((r) => r.complaints)) <= 5, JSON.stringify(runs.map((r) => r.complaints)));
  assert.ok(runs.every((r) => r.questsDone >= 3 && r.questsFailed <= 1));
});
