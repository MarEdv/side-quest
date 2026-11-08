import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSee, WIFE, updateWife, createWife, sightDistance } from '../src/wife.js';
import { createWorld } from '../src/world.js';
import { createRng } from '../src/rng.js';
import { update } from '../src/game.js';
import { giveQuest } from '../src/quests.js';
import { playing, NO_INPUT, mkFlags } from './helpers.js';

const world = createWorld();
const wifeAt = (dir) => ({ x: 480, y: 128, dir });

test('wife sees player in open ground within cone', () => {
  assert.equal(canSee(wifeAt(Math.PI / 2), { x: 480, y: 300 }, world.obstacles), true);
});

test('too far or outside cone is not seen', () => {
  assert.equal(canSee(wifeAt(Math.PI / 2), { x: 480, y: 128 + WIFE.range + 30 }, world.obstacles), false);
  assert.equal(canSee(wifeAt(Math.PI / 2), { x: 150, y: 140 }, world.obstacles), false);
});

test('hedge blocks line of sight, visible once clear of it', () => {
  // hedgeA spans x250-410, y180-210. Wife at (480,128) looking toward (300,260) passes through it.
  const dir = Math.atan2(260 - 128, 300 - 480);
  assert.equal(canSee(wifeAt(dir), { x: 300, y: 260 }, world.obstacles), false);
  assert.equal(canSee(wifeAt(dir), { x: 300, y: 260 }, world.obstacles.filter((o) => o.id !== 'hedgeA')), true);
});

test('shed blocks sight', () => {
  const w = (tx, ty) => ({ x: 600, y: 128, dir: Math.atan2(ty - 128, tx - 600) });
  assert.equal(canSee(w(700, 260), { x: 700, y: 260 }, world.obstacles), true); // left of shed: clear
  assert.equal(canSee(w(815, 230), { x: 815, y: 230 }, world.obstacles), false); // behind shed
});

test('vision mode: gives quest when spotted, counts avoided when hidden', () => {
  const flags = mkFlags({ questInterval: 3 });
  const rng = createRng(1);
  const ctxFor = (player) => ({ player, obstacles: world.obstacles, rng, flags });
  // spotted
  const w = createWife(world, rng, flags);
  w.phase = 'out'; w.timer = 5; w.sweepT = 0; // dir straight down
  const evs = updateWife(w, ctxFor({ x: 480, y: 300 }), 0.01);
  assert.ok(evs.includes('spotted'));
  // hidden behind hedge A
  const w2 = createWife(world, rng, flags);
  w2.phase = 'out'; w2.timer = 0.05; w2.sweepT = 0;
  const seen = [];
  for (let i = 0; i < 10; i++) seen.push(...updateWife(w2, ctxFor({ x: 330, y: 230 }), 0.02));
  assert.ok(!seen.includes('spotted'));
  assert.ok(seen.includes('avoided'));
});

test('game: spotted gives a quest with speech bubble; hidden player gets none', () => {
  const s = playing({ questInterval: 3 });
  s.wife.phase = 'out'; s.wife.timer = 5; s.wife.sweepT = 0;
  s.player.x = 480; s.player.y = 250;
  update(s, NO_INPUT, 1 / 60);
  assert.equal(s.quests.length, 1);
  assert.ok(s.wife.bubble && s.wife.bubble.text.length > 0);
  assert.ok(s.events.some((e) => e.type === 'spotted'));

  const h = playing({ questInterval: 3 });
  h.wife.phase = 'out'; h.wife.timer = 0.05; h.wife.sweepT = 0;
  h.player.x = 330; h.player.y = 240;
  for (let i = 0; i < 10; i++) update(h, NO_INPUT, 1 / 60);
  assert.equal(h.quests.length, 0);
  assert.equal(h.stats.questsAvoided, 1);
});

test('wife warns about 1.5s before coming out', () => {
  const flags = mkFlags({ questInterval: 3 });
  const rng = createRng(2);
  const w = createWife(world, rng, flags);
  w.timer = 0.01;
  const ctx = { player: { x: 0, y: 500 }, obstacles: world.obstacles, rng, flags };
  assert.ok(updateWife(w, ctx, 0.02).includes('warning'));
  assert.equal(w.phase, 'warning');
  assert.equal(w.timer > 1.4, true);
});

test('random mode: quest called regardless of player location', () => {
  const s = playing({ wifeMode: 'random', questInterval: 3 });
  s.player.x = 100; s.player.y = 500; // far, out of any cone
  for (let i = 0; i < 60 * 8 && s.quests.length === 0; i++) update(s, NO_INPUT, 1 / 60);
  assert.equal(s.quests.length, 1);
});

test('sightDistance: full range in the open, clipped at a hedge, and consistent with canSee', () => {
  const w = wifeAt(Math.PI / 2);
  assert.equal(sightDistance(w, Math.PI / 2, world.obstacles), WIFE.range);
  const a = Math.atan2(260 - 128, 300 - 480); // through hedgeA
  const d = sightDistance(w, a, world.obstacles);
  assert.ok(d > 60 && d < 200, `clipped distance ${d}`);
  const just = (k) => ({ x: 480 + Math.cos(a) * (d + k), y: 128 + Math.sin(a) * (d + k) });
  assert.equal(canSee({ ...w, dir: a }, just(-2), world.obstacles), true);
  assert.equal(canSee({ ...w, dir: a }, just(40), world.obstacles), false);
});

test('hiding while the quest cap is full is not counted as avoided', () => {
  for (const flags of [{ questInterval: 3, maxActiveQuests: 0 }, { questInterval: 3, maxActiveQuests: 1 }]) {
    const h = playing(flags);
    if (flags.maxActiveQuests === 1) giveQuest(h);
    h.wife.phase = 'out'; h.wife.timer = 0.05; h.wife.sweepT = 0;
    h.player.x = 330; h.player.y = 240;
    for (let i = 0; i < 10; i++) update(h, NO_INPUT, 1 / 60);
    assert.equal(h.wife.phase, 'inside');
    assert.equal(h.stats.questsAvoided, 0);
  }
});
