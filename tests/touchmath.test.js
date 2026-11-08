import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  computeLayout, chromeLayout, PAUSE_SIZE, screenToGame, joystickVector, clampOffset, tapWalkVector, tapIntent, mergeInput, touchActive,
  STICK_RADIUS, STICK_DEAD,
} from '../src/touchmath.js';
import { update, PLAYER_SPEED } from '../src/game.js';
import { playing, NO_INPUT } from './helpers.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const quiet = { wifeMode: 'random', questInterval: 300 };

test('landscape layout letterboxes horizontally and maps screen to game', () => {
  const L = computeLayout(844, 390);
  near(L.scale, 390 / 540);
  near(L.height, 390); near(L.top, 0);
  near(L.left, (844 - 960 * 390 / 540) / 2);
  assert.equal(L.portrait, false);
  const c = screenToGame(844 / 2, 195, L);
  near(c.x, 480); near(c.y, 270);
  const tl = screenToGame(L.left, L.top, L);
  near(tl.x, 0); near(tl.y, 0);
});

test('landscape letterboxes vertically when the screen is wider-short, and honours insets + hint', () => {
  const L = computeLayout(1000, 800, { hintH: 30 });
  near(L.scale, 1000 / 960);
  near(L.top, (770 - L.height) / 2);
  const I = computeLayout(844, 390, { insets: { left: 47, right: 47, top: 0, bottom: 21 } });
  near(I.scale, 369 / 540);
  assert.ok(I.left >= 47 && I.left + I.width <= 844 - 47 + 1e-6);
});

test('portrait layout is top aligned, full width', () => {
  const L = computeLayout(390, 844);
  assert.equal(L.portrait, true);
  near(L.scale, 390 / 960);
  near(L.left, 0); near(L.top, 0);
  const p = screenToGame(195, 100, L);
  near(p.x, 480); near(p.y, 100 / L.scale);
  // a touch below the canvas clamps to the bottom edge
  near(screenToGame(10, 700, L).y, 540);
  const T = computeLayout(390, 844, { insets: { top: 47 } });
  near(T.top, 47);
  near(screenToGame(195, 47, T).y, 0);
});

test('joystick: dead zone, clamp, direction, scaling', () => {
  assert.deepEqual(joystickVector(0, 0), { x: 0, y: 0, mag: 0 });
  assert.equal(joystickVector(STICK_RADIUS * STICK_DEAD * 0.9, 0).mag, 0);
  const full = joystickVector(500, 0);
  near(full.x, 1); near(full.y, 0); near(full.mag, 1);
  const diag = joystickVector(300, -300);
  near(Math.hypot(diag.x, diag.y), 1);
  assert.ok(diag.x > 0 && diag.y < 0);
  const half = joystickVector(0, STICK_RADIUS * 0.575);
  near(half.mag, (0.575 - STICK_DEAD) / (1 - STICK_DEAD));
  assert.ok(half.y > 0 && half.x === 0);
  const k = clampOffset(300, 400);
  near(Math.hypot(k.x, k.y), STICK_RADIUS);
  assert.deepEqual(clampOffset(10, 20), { x: 10, y: 20 });
});

test('analog movement: direction and speed scaled by magnitude, capped at 1', () => {
  const s = playing(quiet); const x0 = s.player.x, y0 = s.player.y;
  update(s, { ...NO_INPUT, moveX: 0.5, moveY: 0 }, 0.1);
  near(s.player.x - x0, PLAYER_SPEED * 0.5 * 0.1); near(s.player.y, y0);
  assert.equal(s.player.moving, true);
  const t = playing(quiet);
  update(t, { ...NO_INPUT, moveX: 3, moveY: 4 }, 0.1); // over-length vector is capped to 1
  near(Math.hypot(t.player.x - x0, t.player.y - y0), PLAYER_SPEED * 0.1);
  assert.ok(t.player.y > y0 && t.player.x > x0);
  const u = playing(quiet);
  update(u, { ...NO_INPUT, moveX: -0.8, moveY: 0 }, 0.05);
  assert.equal(u.player.facing, -1);
});

test('keyboard movement is unchanged (and analog zero falls back to keys)', () => {
  const s = playing(quiet); const x0 = s.player.x, y0 = s.player.y;
  update(s, { ...NO_INPUT, right: true }, 0.1);
  near(s.player.x - x0, PLAYER_SPEED * 0.1);
  const d = playing(quiet);
  update(d, { ...NO_INPUT, right: true, down: true, moveX: 0, moveY: 0 }, 0.1);
  near(Math.hypot(d.player.x - x0, d.player.y - y0), PLAYER_SPEED * 0.1); // diagonal normalised
  near(d.player.x - x0, d.player.y - y0);
  const i = playing(quiet);
  update(i, NO_INPUT, 0.1);
  assert.equal(i.player.moving, false);
  assert.equal(i.player.x, x0);
});

test('tap-to-walk: moves toward the target, then stops', () => {
  const s = playing(quiet);
  const target = { x: s.player.x + 100, y: s.player.y - 60 };
  let steps = 0;
  for (; steps < 600; steps++) {
    const v = tapWalkVector(s.player, target);
    update(s, { ...NO_INPUT, moveX: v.x, moveY: v.y }, 1 / 60);
    if (!s.player.moving) break;
  }
  assert.ok(steps > 30 && steps < 599);
  assert.ok(Math.hypot(s.player.x - target.x, s.player.y - target.y) <= 3 + 1e-6);
  const px = s.player.x;
  for (let i = 0; i < 30; i++) { const v = tapWalkVector(s.player, target); update(s, { ...NO_INPUT, moveX: v.x, moveY: v.y }, 1 / 60); }
  assert.equal(s.player.x, px); // stays put
  assert.deepEqual(tapWalkVector({ x: 5, y: 5 }, { x: 6, y: 6 }), { x: 0, y: 0 });
});

test('holding a finger near a task sets action only once the player is in range', () => {
  const s = playing(quiet);
  const c = s.chores[0];
  const far = tapIntent(s, { x: c.x + 20, y: c.y });
  assert.equal(far.action, false);              // player is far away
  assert.deepEqual(far.target, { x: c.x, y: c.y }); // but the target snaps to the spot
  s.player.x = c.x + 10; s.player.y = c.y;
  assert.equal(tapIntent(s, { x: c.x + 30, y: c.y + 20 }).action, true);
  assert.equal(tapIntent(s, { x: c.x + 80, y: c.y }).action, false); // finger not near the task
  assert.deepEqual(tapIntent(s, { x: c.x + 80, y: c.y }).target, { x: c.x + 80, y: c.y });
  c.done = true;
  assert.equal(tapIntent(s, { x: c.x, y: c.y }).action, false); // finished chores are not tasks
});

test('tap near a quest pickup / drop', () => {
  const s = playing(quiet);
  s.chores.forEach((c) => { c.done = true; });
  s.quests.push({ id: 1, stage: 'fetch', pickup: { x: 300, y: 300 }, drop: { x: 700, y: 300 } });
  s.player.x = 310; s.player.y = 300;
  assert.equal(tapIntent(s, { x: 305, y: 305 }).action, true);
  s.carry = 1; s.quests[0].stage = 'deliver';
  assert.equal(tapIntent(s, { x: 305, y: 305 }).action, false);
  s.player.x = 690;
  assert.equal(tapIntent(s, { x: 700, y: 310 }).action, true);
});

test('mergeInput ORs booleans; analog wins when non-zero', () => {
  const kb = { ...NO_INPUT, left: true, pause: true };
  const m = mergeInput(kb, { ...NO_INPUT, action: true, moveX: 0, moveY: 0 });
  assert.equal(m.left, true); assert.equal(m.action, true); assert.equal(m.pause, true);
  assert.equal(m.moveX, 0);
  const a = mergeInput(kb, { ...NO_INPUT, moveX: 0.3, moveY: -0.4 });
  assert.equal(a.moveX, 0.3); assert.equal(a.moveY, -0.4);
});

test('touchActive follows the touch flag', () => {
  assert.equal(touchActive('on', false), true);
  assert.equal(touchActive('off', true), false);
  assert.equal(touchActive('auto', true), true);
  assert.equal(touchActive('auto', false), false);
});

test('portrait touch: pause button sits below the canvas (not over the HUD), hint and rotate hint below it (D-19)', () => {
  const L = computeLayout(390, 844, { insets: { top: 47, bottom: 34 } });
  const ui = chromeLayout(L, true);
  assert.ok(ui.pauseTop >= L.top + L.height, 'pause button must not overlap the canvas');
  assert.ok(ui.hintTop >= ui.pauseTop + PAUSE_SIZE, 'hint line below the pause button');
  assert.ok(ui.rotateTop > ui.hintTop);
  assert.ok(ui.rotateTop + 60 < 844 - 34 - 118, 'rotate hint stays above the WORK button');
});

test('landscape / keyboard: pause stays in the CSS corner, hint right under the canvas', () => {
  const L = computeLayout(844, 390);
  const ui = chromeLayout(L, true);
  assert.equal(ui.pauseTop, null);
  near(ui.hintTop, L.top + L.height + 6);
  // the corner button (right: 6px, 44 px wide) lands in the side letterbox on a phone
  assert.ok(844 - 6 - PAUSE_SIZE >= L.left + L.width);
  assert.equal(chromeLayout(computeLayout(390, 844), false).pauseTop, null);
});

test('logic modules stay DOM-free (CLAUDE.md)', () => {
  for (const f of ['game', 'chores', 'quests', 'wife', 'world', 'geometry', 'rng', 'config', 'touchmath', 'storage', 'scores', 'uimodel']) {
    const src = readFileSync(new URL(`../src/${f}.js`, import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(src, /\b(document|window|navigator|innerWidth|innerHeight|matchMedia|performance)\b/, f);
  }
});
