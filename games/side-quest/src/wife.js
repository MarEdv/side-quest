// The wife: patio appearances and line-of-sight vision. Pure.
import { pointInCone, segmentIntersectsAABB, segmentAABBEntry } from './geometry.js';

export const WIFE = {
  fov: (70 * Math.PI) / 180,
  range: 320,
  warnTime: 1.5,
  outTime: 5,
  spottedLinger: 3, // minimum seconds she stays out after calling a quest
  sweepAmp: 1.0, // radians either side of straight down
  sweepPeriod: 4.5,
  baseDir: Math.PI / 2,
  walkSpeed: 90, // px/s while roaming (player: 150)
  lookTime: 4, // seconds she stands and sweeps at the end of a route
  hybridCallChance: 0.4, // hybrid mode: chance she calls a quest anyway when a trip ends without spotting the player (L-6, D-27)
  roamInsideScale: 0.55, // a roaming trip takes ~8 s instead of 5, so she waits less inside to keep the pace (D-15)
};

// Vision mode roams when `wifeRoam` is on; hybrid always roams (wifeRoam is ignored there, D-27).
const roams = (flags) => flags.wifeMode === 'hybrid' || (!!flags.wifeRoam && flags.wifeMode === 'vision');
// Seconds she stays inside before the next warning; `lo`/`hi` are the random multipliers.
const insideTime = (flags, rng, lo, hi) => flags.questInterval * rng.range(lo, hi) * (roams(flags) ? WIFE.roamInsideScale : 1);

export function createWife(world, rng, flags) {
  return {
    phase: 'inside', // 'inside' | 'warning' | 'out'
    timer: insideTime(flags, rng, 0.5, 1),
    x: world.wifePos.x, y: world.wifePos.y,
    dir: WIFE.baseDir,
    range: flags.visionRange ?? WIFE.range,
    leg: null, // roaming only: 'to' | 'look' | 'back' | 'linger'
    route: null, stop: 0, moving: false, lookDir: WIFE.baseDir,
    sweepT: rng.range(0, WIFE.sweepPeriod),
    spotted: false,
    bubble: null, // {text, t}
  };
}

// True if the wife (at her current position/direction) sees the player: inside the cone and
// no sight-blocking obstacle between them.
export function canSee(wife, player, obstacles) {
  if (!pointInCone(wife.x, wife.y, wife.dir, WIFE.fov, wife.range ?? WIFE.range, player.x, player.y)) return false;
  return !isSightBlocked(wife.x, wife.y, player.x, player.y, obstacles);
}

export function isSightBlocked(x1, y1, x2, y2, obstacles) {
  for (const o of obstacles) if (o.blocksSight && segmentIntersectsAABB(x1, y1, x2, y2, o)) return true;
  return false;
}

// How far she can see along `angle` before a sight-blocking obstacle (capped at her range).
// render.js uses this to draw the cone clipped by obstacles so it matches canSee.
export function sightDistance(wife, angle, obstacles) {
  const range = wife.range ?? WIFE.range;
  const ex = wife.x + Math.cos(angle) * range, ey = wife.y + Math.sin(angle) * range;
  let t = 1;
  for (const o of obstacles) {
    if (!o.blocksSight) continue;
    const e = segmentAABBEntry(wife.x, wife.y, ex, ey, o);
    if (e >= 0 && e < t) t = e;
  }
  return t * range;
}

// Move toward (tx,ty) at WIFE.walkSpeed, facing the direction of motion. Returns true on arrival.
function walkToward(wife, tx, ty, dt) {
  const dx = tx - wife.x, dy = ty - wife.y, d = Math.hypot(dx, dy);
  const step = WIFE.walkSpeed * dt;
  if (d <= step) { wife.x = tx; wife.y = ty; return true; }
  wife.dir = Math.atan2(dy, dx);
  wife.x += (dx / d) * step; wife.y += (dy / d) * step;
  wife.moving = true;
  return false;
}

// One tick of the roaming 'out' phase (vision mode with wifeRoam, or hybrid mode). Walks to a waypoint, sweeps, walks back.
function updateRoam(wife, ctx, dt, ev) {
  const { flags, rng, world } = ctx;
  wife.moving = false;
  if (wife.leg === 'to') {
    const p = wife.route[wife.stop];
    if (walkToward(wife, p.x, p.y, dt) && ++wife.stop >= wife.route.length) {
      wife.leg = 'look'; wife.timer = WIFE.lookTime; wife.sweepT = 0; wife.lookDir = wife.dir;
    }
  } else if (wife.leg === 'look') {
    wife.sweepT += dt; wife.timer -= dt;
    wife.dir = wife.lookDir + Math.sin((wife.sweepT / WIFE.sweepPeriod) * 2 * Math.PI) * WIFE.sweepAmp;
    if (wife.timer <= 0) wife.leg = 'back';
  } else if (wife.leg === 'linger') {
    wife.timer -= dt;
    if (wife.timer <= 0) wife.leg = 'back';
  } else if (wife.leg === 'back') {
    // Retrace the route in reverse, ending at the door.
    const p = wife.stop > 0 ? wife.route[wife.stop - 1] : world.wifePos;
    if (walkToward(wife, p.x, p.y, dt) && --wife.stop < 0) {
      if (!wife.spotted) {
        // Hybrid: she may call a quest anyway ('forced'), but only if one can be given (cap not full), so no roll is
        // wasted. A forced quest is not an 'avoided' one (L-6). ctx.hybridChance lets tests inject the probability.
        const chance = ctx.hybridChance ?? WIFE.hybridCallChance;
        if (flags.wifeMode === 'hybrid' && ctx.canCall !== false && rng.next() < chance) ev.push('forced');
        else ev.push('avoided');
      }
      wife.phase = 'inside'; wife.leg = null; wife.bubble = null; wife.dir = WIFE.baseDir;
      wife.timer = insideTime(flags, rng, 0.7, 1.3);
      ev.push('left');
      return;
    }
  }
  if (!wife.spotted && canSee(wife, ctx.player, ctx.obstacles)) {
    wife.spotted = true;
    ev.push('spotted');
    // Caught on the way out or while looking: she stops and calls out. Caught on the way home: she keeps walking.
    if (wife.leg !== 'back') { wife.leg = 'linger'; wife.timer = WIFE.spottedLinger; wife.moving = false; }
  }
}

export function sayBubble(wife, text, seconds = 4) {
  wife.bubble = { text, t: seconds };
}

// Advance the wife. ctx = {player, obstacles, rng, flags, world}. Returns an array of event types:
// 'warning', 'out', 'spotted', 'callout' (random mode), 'forced' (hybrid: calls anyway), 'avoided', 'left'.
// ctx may also carry canCall (false when the quest cap is full) and hybridChance (test override).
export function updateWife(wife, ctx, dt) {
  const ev = [];
  const { flags, rng } = ctx;
  if (wife.bubble) { wife.bubble.t -= dt; if (wife.bubble.t <= 0) wife.bubble = null; }
  const roaming = wife.phase === 'out' && wife.leg !== null;
  if (!roaming) wife.timer -= dt;
  if (wife.phase === 'inside') {
    if (wife.timer <= 0) { wife.phase = 'warning'; wife.timer = WIFE.warnTime; ev.push('warning'); }
  } else if (wife.phase === 'warning') {
    if (wife.timer <= 0) {
      wife.phase = 'out'; wife.timer = WIFE.outTime; wife.spotted = false;
      wife.dir = WIFE.baseDir + Math.sin((wife.sweepT / WIFE.sweepPeriod) * 2 * Math.PI) * WIFE.sweepAmp;
      ev.push('out');
      if (roams(flags)) {
        wife.route = rng.pick(ctx.world.wifeRoutes); wife.stop = 0; wife.leg = 'to'; wife.moving = true;
        wife.dir = Math.atan2(wife.route[0].y - wife.y, wife.route[0].x - wife.x);
        return ev;
      }
      if (flags.wifeMode === 'random') { wife.spotted = true; ev.push('callout'); wife.timer = Math.max(wife.timer, WIFE.spottedLinger); }
    }
  } else if (wife.phase === 'out' && roaming) {
    updateRoam(wife, ctx, dt, ev);
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
      wife.timer = insideTime(flags, rng, 0.7, 1.3);
      ev.push('left');
    }
  }
  return ev;
}
