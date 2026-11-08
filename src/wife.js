// The wife: patio appearances and line-of-sight vision. Pure.
import { pointInCone, segmentIntersectsAABB } from './geometry.js';

export const WIFE = {
  fov: (70 * Math.PI) / 180,
  range: 320,
  warnTime: 1.5,
  outTime: 5,
  spottedLinger: 3, // minimum seconds she stays out after calling a quest
  sweepAmp: 1.0, // radians either side of straight down
  sweepPeriod: 4.5,
  baseDir: Math.PI / 2,
};

export function createWife(world, rng, flags) {
  return {
    phase: 'inside', // 'inside' | 'warning' | 'out'
    timer: rng.range(0.5, 1) * flags.questInterval,
    x: world.wifePos.x, y: world.wifePos.y,
    dir: WIFE.baseDir,
    sweepT: rng.range(0, WIFE.sweepPeriod),
    spotted: false,
    bubble: null, // {text, t}
  };
}

// True if the wife (at her current position/direction) sees the player: inside the cone and
// no sight-blocking obstacle between them.
export function canSee(wife, player, obstacles) {
  if (!pointInCone(wife.x, wife.y, wife.dir, WIFE.fov, WIFE.range, player.x, player.y)) return false;
  return !isSightBlocked(wife.x, wife.y, player.x, player.y, obstacles);
}

export function isSightBlocked(x1, y1, x2, y2, obstacles) {
  for (const o of obstacles) if (o.blocksSight && segmentIntersectsAABB(x1, y1, x2, y2, o)) return true;
  return false;
}

export function sayBubble(wife, text, seconds = 4) {
  wife.bubble = { text, t: seconds };
}

// Advance the wife. ctx = {player, obstacles, rng, flags}. Returns an array of event types:
// 'warning', 'out', 'spotted', 'callout' (random mode), 'avoided', 'left'.
export function updateWife(wife, ctx, dt) {
  const ev = [];
  const { flags, rng } = ctx;
  if (wife.bubble) { wife.bubble.t -= dt; if (wife.bubble.t <= 0) wife.bubble = null; }
  wife.timer -= dt;
  if (wife.phase === 'inside') {
    if (wife.timer <= 0) { wife.phase = 'warning'; wife.timer = WIFE.warnTime; ev.push('warning'); }
  } else if (wife.phase === 'warning') {
    if (wife.timer <= 0) {
      wife.phase = 'out'; wife.timer = WIFE.outTime; wife.spotted = false;
      wife.dir = WIFE.baseDir + Math.sin((wife.sweepT / WIFE.sweepPeriod) * 2 * Math.PI) * WIFE.sweepAmp;
      ev.push('out');
      if (flags.wifeMode === 'random') { wife.spotted = true; ev.push('callout'); wife.timer = Math.max(wife.timer, WIFE.spottedLinger); }
    }
  } else if (wife.phase === 'out') {
    wife.sweepT += dt;
    wife.dir = WIFE.baseDir + Math.sin((wife.sweepT / WIFE.sweepPeriod) * 2 * Math.PI) * WIFE.sweepAmp;
    if (flags.wifeMode === 'vision' && !wife.spotted && canSee(wife, ctx.player, ctx.obstacles)) {
      wife.spotted = true;
      wife.timer = Math.max(wife.timer, WIFE.spottedLinger);
      ev.push('spotted');
    }
    if (wife.timer <= 0) {
      if (flags.wifeMode === 'vision' && !wife.spotted) ev.push('avoided');
      wife.phase = 'inside';
      wife.bubble = null;
      wife.timer = flags.questInterval * rng.range(0.7, 1.3);
      ev.push('left');
    }
  }
  return ev;
}
