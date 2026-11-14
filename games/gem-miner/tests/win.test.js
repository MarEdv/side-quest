import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, update, townDirection, dreamDirection } from '../src/game.js';
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

test('the shop tile only prompts; E in town opens the shop (D21)', () => {
  const s = createGame({ seed: 5, size: 128, flags: {} });
  const sh = s.world.shop;
  assert.equal(s.player.x, sh.x); assert.equal(s.player.y, sh.y + 2);
  const seen = [];
  for (let k = 0; k < 60; k++) { update(s, { dx: 0, dy: -1 }, 1 / 60); seen.push(...s.events.map((e) => e.type)); }
  assert.ok(s.player.y < sh.y, 'walked across the shop tile');
  assert.ok(seen.includes('atShop'));
  assert.ok(!seen.includes('shop'), 'stepping on the shop tile does not open the shop');
  update(s, { dx: 0, dy: 0, shop: true }, 1 / 60);
  assert.ok(s.events.some((e) => e.type === 'shop'), 'E in town opens it');
});

test('the dream compass never points out through the bedrock edge (D13 check)', () => {
  const VEC = { '→': [1, 0], '↘': [1, 1], '↓': [0, 1], '↙': [-1, 1], '←': [-1, 0], '↖': [-1, -1], '↑': [0, -1], '↗': [1, -1] };
  for (const size of [128, 256, 512]) for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const s = createGame({ seed, size, flags: {} });
    s.inv.hatchets[3] = true;
    const { dream } = s.world;
    assert.ok(dream.x - 4 >= 2 && dream.y - 4 >= 2 && dream.x + 4 <= size - 3 && dream.y + 4 <= size - 3, 'chamber inside the edge');
    for (let k = 1; k < size - 1; k++) for (const [x, y] of [[k, 1], [k, size - 2], [1, k], [size - 2, k]]) {
      s.player.x = x; s.player.y = y;
      const d = dreamDirection(s);
      if (!d.arrow) continue;
      const [ax, ay] = VEC[d.arrow];
      assert.ok(x + ax >= 1 && x + ax <= size - 2 && y + ay >= 1 && y + ay <= size - 2, `${size}/${seed} at ${x},${y}: ${d.arrow}`);
    }
  }
});
