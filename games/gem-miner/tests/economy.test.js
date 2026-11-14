import test from 'node:test';
import assert from 'node:assert/strict';
import { newInventory, sellGem, sellAll, buyHatchet, grantHatchet, prices, PRICES, GEMS, DREAM, backpackValue } from '../src/economy.js';
import { createGame, update, sellAll as gSellAll, buyHatchet as gBuy } from '../src/game.js';
import { T } from '../src/tiles.js';

test('gem values rise in order', () => {
  for (let i = 1; i < GEMS.length; i++) assert.ok(GEMS[i].value > GEMS[i - 1].value);
  assert.equal(GEMS[0].id, 'quartz'); assert.equal(GEMS[6].id, 'diamond');
});

test('sell one and sell all', () => {
  const inv = newInventory();
  inv.gems.quartz = 3; inv.gems.ruby = 1;
  assert.equal(backpackValue(inv), 3 * 3 + 260);
  const r = sellGem(inv, 'quartz', 2);
  assert.deepEqual([r.ok, r.coins, inv.gems.quartz, inv.coins], [true, 6, 1, 6]);
  assert.equal(sellGem(inv, 'topaz').ok, false);
  const all = sellAll(inv);
  assert.equal(all.ok, true); assert.equal(all.coins, 3 + 260);
  assert.equal(inv.coins, 6 + 263);
  assert.equal(backpackValue(inv), 0);
  assert.equal(sellAll(inv).ok, false);
});

test('buy: success, cannot afford, already owned, unknown', () => {
  const inv = newInventory({ coins: 200 });
  assert.equal(buyHatchet(inv, 1).ok, true);
  assert.equal(inv.coins, 200 - PRICES[1]);
  assert.equal(inv.hatchets[1], true);
  assert.equal(buyHatchet(inv, 1).reason, 'owned');
  const poor = buyHatchet(inv, 2);
  assert.deepEqual([poor.ok, poor.reason], [false, 'poor']);
  assert.equal(poor.need, PRICES[2] - inv.coins);
  assert.equal(inv.hatchets[2], false);
  assert.equal(buyHatchet(inv, 0).ok, false);
  assert.equal(buyHatchet(inv, 9).ok, false);
});

test('prices scale with the world size', () => {
  assert.deepEqual(prices(256), [...PRICES]);
  assert.ok(prices(128)[3] < PRICES[3] && prices(512)[3] > PRICES[3]);
  assert.ok(PRICES[1] < PRICES[2] && PRICES[2] < PRICES[3]);
});

test('the dream diamond cannot be sold', () => {
  const inv = newInventory();
  inv.gems.dream = 1; inv.dream = true;
  const r = sellGem(inv, DREAM.id);
  assert.equal(r.ok, false); assert.equal(r.reason, 'unsellable');
  sellAll(inv);
  assert.equal(inv.coins, 0); assert.equal(inv.gems.dream, 1);
});

test('a hatchet from a chest: given, or half its price when already owned', () => {
  const inv = newInventory();
  assert.equal(grantHatchet(inv, 1).owned, false);
  assert.equal(inv.hatchets[1], true);
  const r = grantHatchet(inv, 1);
  assert.deepEqual([r.owned, r.coins], [true, PRICES[1] / 2]);
});

test('game wrappers update stats and emit events', () => {
  const s = createGame({ seed: 1, size: 128, flags: {} });
  s.inv.gems.topaz = 4;
  const r = gSellAll(s);
  assert.equal(r.coins, 80);
  assert.equal(s.stats.coinsEarned, 80);
  s.inv.coins = 0;
  assert.equal(gBuy(s, 1).reason, 'poor');
  s.inv.coins = 1000;
  assert.equal(gBuy(s, 1).ok, true);
  assert.ok(s.events.some((e) => e.type === 'buy'));
});

test('chests: coins, gems and hatchets', () => {
  const s = createGame({ seed: 2, size: 128, flags: {} });
  const place = (c) => {
    const i = s.player.y * s.size + s.player.x + 1;
    s.world.tiles[i] = T.CHEST; s.world.chests.set(i, { id: 99, x: s.player.x + 1, y: s.player.y, ...c });
    update(s, { dx: 1, dy: 0 }, 1 / 60);
    assert.equal(s.world.tiles[i], T.AIR);
    s.cd = 0;
  };
  place({ kind: 'coins', coins: 77 });
  assert.equal(s.inv.coins, 77);
  place({ kind: 'gems', gem: 2, count: 3 });
  assert.equal(s.inv.gems.topaz, 3);
  place({ kind: 'hatchet', tier: 2 });
  assert.equal(s.inv.hatchets[2], true);
});
