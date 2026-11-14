import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, update, townDirection } from '../src/game.js';
import { T } from '../src/tiles.js';

test('win: picking up the dream diamond ends the game with stats', () => {
  const s = createGame({ seed: 5, size: 128, flags: {} });
  const i = s.player.y * s.size + s.player.x + 1;
  s.world.tiles[i] = T.DREAM;
  for (let k = 0; k < 60; k++) update(s, { dx: 1, dy: 0 }, 1 / 60);
  assert.equal(s.phase, 'won');
  assert.equal(s.inv.dream, true);
  assert.ok(s.stats.time > 0);
  const t = s.stats.time;
  update(s, { dx: 1, dy: 0 }, 1);
  assert.equal(s.stats.time, t, 'timer stops after the win');
});

test('win: the crystal wall blocks everything but the Gem hatchet, then the diamond can be taken', () => {
  const s = createGame({ seed: 6, size: 128, flags: {} });
  const w = s.world, { x, y } = w.dream;
  s.player.x = x;
  s.player.y = y - 3; w.tiles[(y - 3) * w.size + x] = T.AIR;
  s.inv.hatchets[2] = true;
  let hint = '';
  for (let k = 0; k < 120; k++) { update(s, { dx: 0, dy: 1 }, 1 / 60); hint = s.hint || hint; }
  assert.equal(s.phase, 'playing');
  s.player.y = y - 3; s.inv.hatchets[3] = true;
  for (let k = 0; k < 60 * 12 && s.phase === 'playing'; k++) update(s, { dx: 0, dy: 1 }, 1 / 60);
  assert.equal(s.phase, 'won');
});

test('town direction hint', () => {
  const s = createGame({ seed: 5, size: 128, flags: {} });
  assert.equal(townDirection(s).dist, 0);
  s.player.x = s.world.town.x + 30; s.player.y = s.world.town.y;
  assert.deepEqual(townDirection(s), { dist: 30, arrow: '←' });
});
