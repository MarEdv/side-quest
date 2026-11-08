// Pure helpers for touch input (no DOM): layout, coordinate conversion, joystick maths, tap-to-walk, input merging.
import { W, H } from './world.js';
import { dist } from './geometry.js';
import { INTERACT_RANGE } from './chores.js';

export const STICK_RADIUS = 60;   // CSS px the knob can travel
export const STICK_DEAD = 0.15;   // fraction of the radius ignored
export const TAP_STOP = 3;        // game px: stop walking this close to the target
export const TAP_TASK_RADIUS = 40; // game px: finger this close to a task counts as "on" it

// Where the 960x540 canvas sits in the viewport. Landscape: centred, letterboxed. Portrait: top-aligned,
// full width, leaving the space below for controls. `hintH` is reserved under the canvas in landscape only.
export function computeLayout(vw, vh, { insets = {}, hintH = 0 } = {}) {
  const l = insets.left || 0, r = insets.right || 0, t = insets.top || 0, b = insets.bottom || 0;
  const portrait = vh > vw;
  const availW = Math.max(1, vw - l - r);
  const availH = Math.max(1, vh - t - b - (portrait ? 0 : hintH));
  const scale = Math.max(0.05, Math.min(availW / W, availH / H));
  const width = W * scale, height = H * scale;
  const left = l + (availW - width) / 2;
  const top = portrait ? t : t + (availH - height) / 2;
  return { left, top, width, height, scale, portrait };
}

// Client (CSS px) -> game coordinates. Clamped to the playfield so a touch in the letterbox aims at the edge.
export function screenToGame(px, py, layout) {
  const x = (px - layout.left) / layout.scale, y = (py - layout.top) / layout.scale;
  return { x: Math.min(W, Math.max(0, x)), y: Math.min(H, Math.max(0, y)) };
}

// Finger offset from the stick origin -> movement vector with magnitude 0..1 (dead zone removed, clamped).
export function joystickVector(dx, dy, radius = STICK_RADIUS, dead = STICK_DEAD) {
  const len = Math.hypot(dx, dy);
  if (len < dead * radius || len === 0) return { x: 0, y: 0, mag: 0 };
  const m = Math.min(1, len / radius);
  const mag = (m - dead) / (1 - dead);
  return { x: (dx / len) * mag, y: (dy / len) * mag, mag };
}

// Where the knob is drawn: the offset clamped to the radius.
export function clampOffset(dx, dy, radius = STICK_RADIUS) {
  const len = Math.hypot(dx, dy);
  if (len <= radius) return { x: dx, y: dy };
  return { x: (dx / len) * radius, y: (dy / len) * radius };
}

// Unit vector from the player towards the target; zero within `stop`.
export function tapWalkVector(player, target, stop = TAP_STOP) {
  const dx = target.x - player.x, dy = target.y - player.y;
  const d = Math.hypot(dx, dy);
  if (d <= stop) return { x: 0, y: 0 };
  return { x: dx / d, y: dy / d };
}

// Task spots that can currently be worked on: undone chores, plus the quest pickup / drop that is next.
export function taskSpots(state) {
  const spots = [];
  for (const c of state.chores) if (!c.done) spots.push({ x: c.x, y: c.y });
  if (state.carry == null) {
    for (const q of state.quests) if (q.stage === 'fetch') spots.push({ x: q.pickup.x, y: q.pickup.y });
  } else {
    const q = state.quests.find((x) => x.id === state.carry);
    if (q) spots.push({ x: q.drop.x, y: q.drop.y });
  }
  return spots;
}

// Resolve a held finger (game coords). Near a task spot (<= radius) the target snaps to the spot, so the player
// walks onto it; `action` is set once the player is within interaction range of that spot.
export function tapIntent(state, pt, radius = TAP_TASK_RADIUS) {
  let best = null, bd = Infinity;
  for (const s of taskSpots(state)) {
    const d = dist(pt.x, pt.y, s.x, s.y);
    if (d <= radius && d < bd) { best = s; bd = d; }
  }
  if (!best) return { target: pt, action: false };
  const p = state.player;
  return { target: best, action: dist(p.x, p.y, best.x, best.y) <= INTERACT_RANGE };
}

// Combine keyboard and touch input: booleans OR-ed; touch analog wins when non-zero.
export function mergeInput(kb, tc) {
  const out = {};
  for (const k of ['up', 'down', 'left', 'right', 'action', 'pause', 'start', 'restart']) out[k] = !!(kb[k] || tc[k]);
  const analog = Math.hypot(tc.moveX || 0, tc.moveY || 0) > 0;
  out.moveX = analog ? tc.moveX : 0;
  out.moveY = analog ? tc.moveY : 0;
  return out;
}

// Are touch controls shown? mode: auto|on|off; hasTouch: device reports touch / coarse pointer, or one was seen.
export const touchActive = (mode, hasTouch) => mode === 'on' || (mode === 'auto' && !!hasTouch);
