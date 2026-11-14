import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, update } from '../src/game.js';
import { serialize, restore, encodeDeltas, decodeDeltas, packBits, unpackBits, toBase64, fromBase64 } from '../src/save.js';
import { createStorage } from '../src/storage.js';
import { T } from '../src/tiles.js';

function played() {
  const s = createGame({ seed: 77, size: 128, flags: { fog: true } });
  s.inv.hatchets[1] = true;
  for (let k = 0; k < 30 * 60; k++) update(s, { dx: k < 900 ? 1 : 0, dy: k < 900 ? 0 : -1 }, 1 / 60);
  s.inv.gems.ruby = 2; s.inv.coins = 123;
  return s;
}

test('helpers round-trip', () => {
  const idx = [5, 3, 100, 70000, 4];
  assert.deepEqual(decodeDeltas(encodeDeltas(idx), 100000), [3, 4, 5, 100, 70000]);
  assert.deepEqual(decodeDeltas('', 10), []);
  assert.equal(decodeDeltas('zz', 10), null);
  const bits = new Uint8Array(21); bits[0] = bits[7] = bits[8] = bits[20] = 1;
  assert.deepEqual(unpackBits(packBits(bits), 21), bits);
  const bytes = new Uint8Array([0, 255, 128, 7]);
  assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
});

test('save round trip restores position, mined tiles, fog, inventory, time', () => {
  const s = played();
  assert.ok(s.changes.length > 5);
  const data = JSON.parse(JSON.stringify(serialize(s)));
  const r = restore(data);
  assert.ok(r);
  assert.deepEqual([r.player.x, r.player.y], [s.player.x, s.player.y]);
  assert.deepEqual(r.world.tiles, s.world.tiles);
  assert.deepEqual(r.fog, s.fog);
  assert.deepEqual(r.inv, s.inv);
  assert.ok(Math.abs(r.stats.time - s.stats.time) < 0.01);
  assert.deepEqual({ ...r.stats, time: 0 }, { ...s.stats, time: 0 });
  assert.equal(r.seed, 77); assert.equal(r.size, 128);
  assert.deepEqual([...r.changes].sort((a, b) => a - b), [...s.changes].sort((a, b) => a - b));
});

test('opened chests stay opened', () => {
  const s = createGame({ seed: 3, size: 128, flags: {} });
  const c = s.world.chestList[0], i = c.y * 128 + c.x;
  s.world.tiles[i] = T.AIR; s.changes.push(i);
  const r = restore(JSON.parse(JSON.stringify(serialize(s))));
  assert.equal(r.world.tiles[i], T.AIR);
});

test('the save is small even at 512 (fog bitset + diff)', () => {
  const s = createGame({ seed: 1, size: 512, flags: { fog: true } });
  for (let i = 0; i < 20000; i++) s.changes.push(i * 7);
  s.fog.fill(1);
  const json = JSON.stringify(serialize(s));
  assert.ok(json.length < 120000, `save is ${json.length} bytes`);
});

test('corrupt or foreign saves are rejected, never thrown', () => {
  const good = JSON.parse(JSON.stringify(serialize(played())));
  const bad = [
    null, undefined, 5, 'x', [], {}, { ...good, v: 2 }, { ...good, seed: 'a' }, { ...good, size: 100 },
    { ...good, mined: 'zz,!!' }, { ...good, mined: 5 }, { ...good, fog: 'AAAA' }, { ...good, fog: 5 },
    { ...good, inv: null }, { ...good, inv: { ...good.inv, hatchets: [true] } }, { ...good, t: -1 }, { ...good, p: [1] },
    { ...good, stats: {} }, { ...good, mined: '1,99999999' },
  ];
  for (const b of bad) assert.equal(restore(b), null, JSON.stringify(b)?.slice(0, 60));
  // a bad player position falls back to the start rather than failing
  const r = restore({ ...good, p: [0, 0] });
  assert.ok(r);
  assert.deepEqual([r.player.x, r.player.y], [r.world.start.x, r.world.start.y]);
});

test('storage wrapper: keys are prefixed, bad JSON and a throwing backend never break', () => {
  const store = new Map();
  const ok = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const st = createStorage(ok);
  assert.equal(st.set('save', { a: 1 }), true);
  assert.deepEqual([...store.keys()], ['gem-miner.save']);
  assert.deepEqual(st.get('save'), { a: 1 });
  store.set('gem-miner.scores', '{not json');
  assert.equal(st.get('scores', 'dflt'), 'dflt');
  st.remove('save');
  assert.equal(st.get('save'), null);
  const boom = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('x'); } };
  const st2 = createStorage(boom);
  assert.equal(st2.set('save', { b: 2 }), false);
  assert.deepEqual(st2.get('save'), { b: 2 }, 'kept in memory');
  assert.doesNotThrow(() => st2.remove('save'));
  const st3 = createStorage(null);
  assert.equal(st3.get('x', 7), 7);
});

test('storage: a quota error is retried on the next write, and reads see the newest value (D24)', () => {
  const store = new Map(); let full = true;
  const be = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { if (full) throw new Error('QuotaExceededError'); store.set(k, v); }, removeItem: (k) => store.delete(k) };
  store.set('gem-miner.save', JSON.stringify({ old: true }));
  const st = createStorage(be);
  assert.equal(st.set('save', { n: 1 }), false);
  assert.equal(st.persistent, false);
  assert.deepEqual(st.get('save'), { n: 1 }, 'the newest value, not the stale one on disk');
  full = false;
  assert.equal(st.set('save', { n: 2 }), true, 'retried once space is free');
  assert.equal(st.persistent, true);
  assert.deepEqual(JSON.parse(store.get('gem-miner.save')), { n: 2 });
});

test('a save keeps its own world settings; URL flags only add display/debug options (D25)', () => {
  const s = createGame({ seed: 9, size: 128, flags: { fog: true, durability: true } });
  const data = JSON.parse(JSON.stringify(serialize(s)));
  const r = restore(data, { durability: false, worldSize: 512, seed: 1, fog: false, camera: 'center' });
  assert.deepEqual([r.seed, r.size, r.fogOn, r.flags.durability, r.flags.camera], [9, 128, true, true, 'center']);
  const old = { ...data }; delete old.wear;            // a save written before `wear` existed
  assert.equal(restore(old, { durability: true }).flags.durability, true);
  assert.equal(restore(old, {}).flags.durability, false);
  assert.equal(restore({ ...data, wear: 'yes' }), null);
  // debug=1 keeps the map revealed on Continue
  const d = restore(data, { debug: true });
  assert.ok(d.fog.every((v) => v === 1));
});
