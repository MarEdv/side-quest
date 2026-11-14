import test from 'node:test';
import assert from 'node:assert/strict';
import { HATCHETS, canCut, mineTime, bestTier, wear } from '../src/mining.js';
import { newInventory } from '../src/economy.js';
import { createGame, update, STEP_TIME } from '../src/game.js';
import { T } from '../src/tiles.js';

const [WOOD, STONE, STEEL, GEM] = [0, 1, 2, 3];

test('what each tier can cut (hardness 1 dirt .. 5 crystal)', () => {
  const cuts = (tier) => [1, 2, 3, 4, 5].filter((h) => canCut(tier, h));
  assert.deepEqual(cuts(WOOD), [1, 2]);
  assert.deepEqual(cuts(STONE), [1, 2, 3]);
  assert.deepEqual(cuts(STEEL), [1, 2, 3, 4]);
  assert.deepEqual(cuts(GEM), [1, 2, 3, 4, 5]);
  assert.equal(canCut(GEM, 99), false);
});

test('each tier digs faster than the previous one', () => {
  for (let h = 1; h <= 4; h++) for (let t = 1; t < 4; t++) assert.ok(mineTime(h, t) < mineTime(h, t - 1) || !canCut(t - 1, h) );
  for (let t = 1; t < 4; t++) assert.ok(HATCHETS[t].speed > HATCHETS[t - 1].speed);
  assert.ok(mineTime(2, 0) > mineTime(1, 0));
});

test('always uses the best owned hatchet', () => {
  assert.equal(bestTier([true, false, false, false]), 0);
  assert.equal(bestTier([true, true, false, false]), 1);
  assert.equal(bestTier([true, false, true, false]), 2);
  assert.equal(bestTier([true, true, true, true]), 3);
});

test('wear: wood never breaks, others break at 0', () => {
  const inv = newInventory();
  for (let i = 0; i < 5000; i++) assert.equal(wear(inv, 0), false);
  assert.equal(inv.hatchets[0], true);
  inv.hatchets[1] = true; inv.dur[1] = 2;
  assert.equal(wear(inv, 1), false);
  assert.equal(wear(inv, 1), true);
  assert.equal(inv.hatchets[1], false);
});

function game(flags = {}) {
  const s = createGame({ seed: 4, size: 128, flags: { fog: true, ...flags } });
  return s;
}
// Put a tile next to the player (east) and mine it by holding right until it opens or time runs out.
function mineEast(s, tile, ring, maxSec = 20) {
  const { x, y } = s.player, i = y * s.size + x + 1;
  s.world.tiles[i] = tile; s.world.ring[i] = ring;
  let t = 0;
  while (t < maxSec && s.world.tiles[i] === tile) { update(s, { dx: 1, dy: 0 }, 1 / 60); t += 1 / 60; }
  return { opened: s.world.tiles[i] !== tile, t, i };
}

test('game: wood cuts dirt and stone, not granite; hint says too hard', () => {
  let s = game();
  assert.equal(mineEast(s, T.DIRT, 0).opened, true);
  s = game(); assert.equal(mineEast(s, T.STONE, 1).opened, true);
  s = game();
  const r = mineEast(s, T.GRANITE, 2, 2);
  assert.equal(r.opened, false);
  assert.match(s.hint, /Too hard/);
  s = game(); s.inv.hatchets[1] = true;
  assert.equal(mineEast(s, T.GRANITE, 2).opened, true);
  s.inv.hatchets[2] = true;
  s = game(); s.inv.hatchets[1] = true;
  assert.equal(mineEast(s, T.OBSIDIAN, 3, 2).opened, false);
  s.inv.hatchets[2] = true;
  assert.equal(mineEast(s, T.OBSIDIAN, 3).opened, true);
  s = game(); s.inv.hatchets[2] = true;
  assert.equal(mineEast(s, T.CRYSTAL, 3, 2).opened, false);
  assert.match(s.hint, /Gem hatchet/);
  s.inv.hatchets[3] = true;
  assert.equal(mineEast(s, T.CRYSTAL, 3).opened, true);
  s = game(); s.inv.hatchets[3] = true;
  assert.equal(mineEast(s, T.BEDROCK, 3, 2).opened, false);
});

test('game: mining time follows hardness and hatchet; mining a gem gives the gem', () => {
  const a = game(), b = game(); b.inv.hatchets[2] = true;
  const ta = mineEast(a, T.STONE, 1).t, tb = mineEast(b, T.STONE, 1).t;
  assert.ok(Math.abs(ta - mineTime(2, 0)) < 0.05, `wood time ${ta}`);
  assert.ok(tb < ta);
  const s = game();
  mineEast(s, T.GEM0 + 3, 0);
  assert.equal(s.inv.gems.emerald, 1);
  assert.equal(s.stats.blocks, 1);
  assert.equal(s.stats.gems, 1);
});

test('game: walking into open ground takes one step time per tile', () => {
  const s = game();
  let t = 0, x0 = s.player.x;
  while (s.player.x < x0 + 3 && t < 5) { update(s, { dx: 1, dy: 0 }, 1 / 60); t += 1 / 60; }
  assert.ok(Math.abs(t - 2 * STEP_TIME) < 0.1, `3 tiles in ${t}`);
});

test('durability flag: off = hatchets never wear; on = they wear and break, wood stays', () => {
  const off = game(); off.inv.hatchets[1] = true; off.inv.dur[1] = 1;
  mineEast(off, T.STONE, 1); mineEast(off, T.STONE, 1);
  assert.equal(off.inv.hatchets[1], true);
  assert.equal(off.inv.dur[1], 1);
  const on = game({ durability: true }); on.inv.hatchets[1] = true; on.inv.dur[1] = 1;
  mineEast(on, T.STONE, 1);
  assert.equal(on.inv.hatchets[1], false, 'stone hatchet broke');
  assert.match(on.hint, /broke/);
  mineEast(on, T.STONE, 1); // wood still cuts stone: not stuck
  assert.equal(on.inv.hatchets[0], true);
  assert.equal(on.stats.blocks, 2);
  const w = game({ durability: true });
  for (let k = 0; k < 40; k++) { w.world.tiles[w.player.y * w.size + w.player.x + 1] = T.DIRT; mineEast(w, T.DIRT, 0); }
  assert.equal(w.inv.hatchets[0], true);
});

test('game: walking and mining speed do not depend on the frame rate (D22)', () => {
  const run = (dt) => {
    const s = game();
    const { x, y } = s.player;
    for (let k = 1; k <= 30; k++) { const i = y * s.size + x + k; s.world.tiles[i] = k % 3 === 0 ? T.STONE : T.AIR; s.world.ring[i] = 1; }
    let t = 0;
    while (s.player.x < x + 30 && t < 30) { update(s, { dx: 1, dy: 0 }, dt); t += dt; }
    return t;
  };
  const ideal = 29 * STEP_TIME + 10 * mineTime(2, 0); // the 30th step lands at this moment
  for (const fps of [30, 60, 144]) {
    const t = run(1 / fps);
    assert.ok(Math.abs(t - ideal) <= 2 / fps + 1e-9, `${fps} fps: ${t.toFixed(3)} s, ideal ${ideal.toFixed(3)} s`);
  }
});

test('game: idle time is not banked into a burst of steps', () => {
  const s = game();
  const { x, y } = s.player;
  for (let k = 1; k <= 3; k++) s.world.tiles[y * s.size + x + k] = T.AIR;
  for (let k = 0; k < 120; k++) update(s, { dx: 0, dy: 0 }, 1 / 60);
  for (let k = 0; k < 2; k++) update(s, { dx: 1, dy: 0 }, 1 / 60);
  assert.equal(s.player.x, x + 1, 'one step, not several');
});
