import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, floodReach, RING_EDGES } from '../src/world.js';
import { T, isGem } from '../src/tiles.js';
import { HATCHETS } from '../src/mining.js';
import { prices, GEMS } from '../src/economy.js';

const SIZES = [128, 256];
const POWER = HATCHETS.map((h) => h.power);

test('generation is deterministic per seed and differs between seeds', () => {
  const a = createWorld(11, 128), b = createWorld(11, 128), c = createWorld(12, 128);
  assert.deepEqual(a.tiles, b.tiles);
  assert.deepEqual(a.dream, b.dream);
  assert.notDeepEqual(a.tiles, c.tiles);
});

for (const size of SIZES) {
  test(`world ${size}: town at the centre, bedrock edge, start and shop`, () => {
    const w = createWorld(5, size);
    assert.equal(w.town.x, size / 2); assert.equal(w.town.y, size / 2);
    assert.equal(w.tiles[w.shop.y * size + w.shop.x], T.SHOP);
    assert.equal(w.tiles[w.start.y * size + w.start.x], T.TOWN);
    for (let k = 0; k < size; k++) {
      assert.equal(w.tiles[k], T.BEDROCK); assert.equal(w.tiles[(size - 1) * size + k], T.BEDROCK);
      assert.equal(w.tiles[k * size], T.BEDROCK); assert.equal(w.tiles[k * size + size - 1], T.BEDROCK);
    }
  });

  test(`world ${size}: rings are ordered by distance from town`, () => {
    const w = createWorld(5, size);
    const sum = [0, 0, 0, 0], n = [0, 0, 0, 0], min = [1e9, 1e9, 1e9, 1e9], max = [0, 0, 0, 0];
    for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
      const i = y * size + x, t = w.tiles[i];
      if (!(t >= T.DIRT && t <= T.OBSIDIAN) && !isGem(t)) continue;
      const d = Math.hypot(x - w.town.x, y - w.town.y), r = w.ring[i];
      sum[r] += d; n[r]++; min[r] = Math.min(min[r], d); max[r] = Math.max(max[r], d);
    }
    for (let r = 0; r < 3; r++) {
      assert.ok(n[r] > 0);
      assert.ok(sum[r] / n[r] < sum[r + 1] / n[r + 1], `mean distance of ring ${r} < ring ${r + 1}`);
      assert.ok(min[r + 1] > min[r] && max[r + 1] > max[r]);
    }
    // ragged but bounded: a dirt cell is never beyond the stone edge + noise margin
    const reach = size / 2 - 1;
    assert.ok(max[0] < (RING_EDGES[0] + 0.09) * reach);
    assert.ok(min[3] > (RING_EDGES[2] - 0.09) * reach);
  });

  test(`world ${size}: exactly one dream diamond, sealed in a crystal wall inside obsidian`, () => {
    const w = createWorld(9, size);
    let dreams = 0;
    for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === T.DREAM) dreams++;
    assert.equal(dreams, 1);
    const { x, y } = w.dream;
    assert.equal(w.tiles[y * size + x], T.DREAM);
    const d = Math.hypot(x - w.town.x, y - w.town.y);
    assert.ok(d > 0.6 * (size / 2), 'far from town');
    assert.equal(w.ring[y * size + x], 3);
    // crystal ring is complete
    for (let k = -2; k <= 2; k++) for (const [a, b] of [[k, -2], [k, 2], [-2, k], [2, k]]) {
      assert.equal(w.tiles[(y + b) * size + x + a], T.CRYSTAL);
    }
  });

  test(`world ${size}: no sell-out of reachability (stone tier etc.) for several seeds`, () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const w = createWorld(seed, size);
      const di = w.dream.y * size + w.dream.x;
      const reach = POWER.map((p) => floodReach(w, p));
      // the dream is behind the crystal for everything but the Gem hatchet
      assert.equal(reach[0][di], 0); assert.equal(reach[1][di], 0); assert.equal(reach[2][di], 0);
      assert.equal(reach[3][di], 1, 'Gem hatchet reaches the dream diamond');
      // Steel reaches the crystal wall (no hidden extra barrier)
      assert.equal(reach[2][(w.dream.y - 3) * size + w.dream.x], 1);
      const chests = [...w.chests.values()];
      const stone = chests.find((c) => c.kind === 'hatchet' && c.tier === 1);
      const steel = chests.find((c) => c.kind === 'hatchet' && c.tier === 2);
      assert.ok(stone && steel, 'both guaranteed hatchet chests exist');
      // stone hatchet chest: dirt ring, reachable with the starting wood hatchet
      assert.equal(w.ring[stone.y * size + stone.x], 0);
      assert.equal(reach[0][stone.y * size + stone.x], 1);
      // steel hatchet chest: granite ring, reachable with the stone hatchet but not wood
      assert.equal(w.ring[steel.y * size + steel.x], 2);
      assert.equal(reach[1][steel.y * size + steel.x], 1);
      assert.equal(reach[0][steel.y * size + steel.x], 0);
      // every chest is reachable with the best hatchet; every gem tile too (nothing is walled in)
      for (const c of chests) assert.equal(reach[3][c.y * size + c.x], 1);
      // income is enough to afford the next hatchet at each stage (no dead end): value of the gems each tier can reach
      const pr = prices(size), value = (r) => { let v = 0; for (let i = 0; i < w.tiles.length; i++) if (isGem(w.tiles[i]) && r[i]) v += GEMS[w.tiles[i] - T.GEM0].value; return v; };
      assert.ok(value(reach[0]) >= 3 * pr[1], `wood reaches ${value(reach[0])} coins of gems`);
      assert.ok(value(reach[1]) >= 1.5 * pr[2], `stone reaches ${value(reach[1])}`);
      assert.ok(value(reach[2]) >= 1.5 * pr[3], `steel reaches ${value(reach[2])}`);
    }
  });
}

test('gems get rarer and more valuable with depth', () => {
  const w = createWorld(3, 256);
  const cnt = [[], [], [], []].map(() => new Array(7).fill(0));
  for (let i = 0; i < w.tiles.length; i++) if (isGem(w.tiles[i])) cnt[w.ring[i]][w.tiles[i] - T.GEM0]++;
  const avg = cnt.map((c) => { let s = 0, n = 0; c.forEach((v, k) => { s += v * k; n += v; }); return s / n; });
  for (let r = 0; r < 3; r++) assert.ok(avg[r] < avg[r + 1], `ring ${r} avg gem index ${avg[r]} < ring ${r + 1} ${avg[r + 1]}`);
  assert.equal(cnt[0][6] + cnt[1][6] + cnt[2][6], 0, 'diamonds only in the obsidian ring');
});
