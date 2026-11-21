// The drive: state, one fixed step, collisions, near misses, score, stages and the summary (G-1, G-2, S-1..S-4, D3, D8).
// Pure and deterministic: createGame(flags, seed) then step(state, input, dt) with a fixed 1/60 s.
//
// State (plain data except `rng`, which is not enumerable): { flags, seed, tick, time, duration, stage, track, player,
// cars, score, crashes, nearMisses, streak, distance, passed: [n0, n1, n2], bonus, penalty, events, ended, endReason
// ('done' | 'wrecked' | null), summary, nextId, spawn }. `events` is emptied at the start of every step; the first
// events (a 'stage' for stage 0) are there right after createGame. Event shapes, all with `type` and `at` (seconds):
//   stage    { stage }                         a new stage started (0 at the start)
//   crash    { carId, kind, speed, count, x, z }   speed is the impact speed (m/s), count the crashes so far
//   nearMiss { carId, gap, points, mult, streak }
//   offroad  {}                                the car left the asphalt
//   barrier  {}                                the car touched the barrier
//   blink    { carId, dir }                    a car switched its blinker on (-1 left, 1 right)
//   end      { reason, summary }               the drive is over
// The input: { left, right, gas, brake, leftPressed, rightPressed } (held booleans, `*Pressed` are edges for steer=lanes).
import { CFG, DIFFICULTIES } from './config.js';
import { DEFAULT_FLAGS } from './flags.js';
import { createRng } from './kit/rng.js';
import { createTrack, stageAt } from './track.js';
import { createPlayer, updatePlayer } from './car.js';
import { populate, stepTraffic } from './traffic.js';
import { emit } from './core.js';

export const STATE_VERSION = 1;

export function createGame(flags = DEFAULT_FLAGS, seed = null) {
  flags = { ...DEFAULT_FLAGS, ...flags };
  seed = seed ?? flags.seed ?? 1;
  const rng = createRng(seed);
  const track = createTrack(seed, flags);
  const s = {
    version: STATE_VERSION, flags, seed, tick: 0, time: 0, duration: CFG.length[flags.length], stage: 0, track,
    player: createPlayer(track), cars: [], score: 0, crashes: 0, nearMisses: 0, streak: 0, distance: 0,
    passed: [0, 0, 0], bonus: 0, penalty: 0, pointAcc: 0, events: [], ended: false, endReason: null, summary: null,
    nextId: 1, spawn: null,
  };
  Object.defineProperty(s, 'rng', { value: rng, enumerable: false, writable: true });
  populate(s);
  emit(s, { type: 'stage', stage: 0 });
  return s;
}

// Stars 1..5 from the score per second of the drive's full length (CFG.stars, scaled by the difficulty).
export function starsFor(score, duration, difficulty = 'normal') {
  const perSecond = score / duration / (CFG.difficulty[difficulty]?.starScale ?? 1);
  return 1 + CFG.stars.filter((x) => perSecond >= x).length;
}

export const multiplier = (streak) => Math.min(CFG.score.maxMult, 1 + Math.floor(streak / CFG.score.streakEvery));

function finish(s, reason) {
  s.ended = true; s.endReason = reason;
  s.summary = {
    score: s.score, stars: starsFor(s.score, s.duration, s.flags.difficulty), distance: Math.round(s.distance), topSpeed: s.player.topSpeed,
    nearMisses: s.nearMisses, crashes: s.crashes, endReason: reason, seed: s.seed, length: s.flags.length,
    road: s.flags.road, difficulty: DIFFICULTIES.includes(s.flags.difficulty) ? s.flags.difficulty : 'normal',
    time: Math.round(s.time * 100) / 100, passed: [...s.passed],
  };
  emit(s, { type: 'end', reason, summary: s.summary });
}

function crash(s, c, penetrationX, penetrationZ) {
  const p = s.player, K = CFG.crash;
  const impact = Math.abs(p.speed - c.speed);
  p.speed *= K.speedMult;
  p.crashTimer = K.timer;
  c.hit = K.carCooldown; c.noNear = true;
  const sideX = Math.sign(c.x - p.x) || (c.x >= 0 ? 1 : -1);
  const dz = c.z - p.z;
  if (c.speed < 0 || penetrationX < penetrationZ) {
    // head on, or a side hit: the other car is shoved sideways (away from the player), the player a third as far
    c.x += sideX * K.sidePush;
    p.x = Math.max(-s.track.barrier, Math.min(s.track.barrier, p.x - sideX * (K.sidePush / 3)));
    if (c.speed >= 0 && penetrationZ > 0) c.z += Math.sign(dz || 1) * Math.min(penetrationZ, 0.5);
  } else if (dz >= 0) { // hit it from behind: it is shoved forward and clear
    c.z = p.z + (p.length + c.length) / 2 + 0.3;
    c.speed += K.shoveSpeed;
  } else { // it hit us from behind: it is shoved back and slows to our speed
    c.z = p.z - (p.length + c.length) / 2 - 0.3;
    c.speed = Math.min(c.speed, p.speed);
  }
  s.crashes++; s.streak = 0;
  s.score = Math.max(0, s.score - CFG.score.penalty); s.penalty += CFG.score.penalty;
  emit(s, { type: 'crash', carId: c.id, kind: c.kind, speed: Math.round(impact * 10) / 10, count: s.crashes, x: p.x, z: p.z });
  if (s.flags.crash === 'hard' && s.crashes >= K.hardLimit) finish(s, 'wrecked');
}

function nearMiss(s, c, gap) {
  const lanes = s.flags.steer === 'lanes';
  const mult = multiplier(s.streak);
  const points = Math.round(CFG.score.nearMiss * mult * (lanes ? CFG.score.lanesBonus : 1));
  s.streak++; s.nearMisses++;
  s.score += points; s.bonus += points;
  emit(s, { type: 'nearMiss', carId: c.id, gap: Math.round(gap * 100) / 100, points, mult, streak: s.streak });
}

// Collisions, near misses and passes between the player and every car, after both have moved.
function interact(s) {
  const p = s.player;
  const limit = s.flags.steer === 'lanes' ? CFG.score.nearGapLanes : CFG.score.nearGap;
  for (const c of s.cars) {
    const dz = c.z - p.z, dx = c.x - p.x;
    const px = (p.width + c.width) / 2 - Math.abs(dx), pz = (p.length + c.length) / 2 - Math.abs(dz);
    if (c.hit > 0) c.hit -= CFG.dt;
    if (px > 0 && pz > 0) {
      if (c.hit <= 0 && !s.ended) crash(s, c, px, pz);
      c.gap = Math.min(c.gap, 0);
    } else if (pz > -2) c.gap = Math.min(c.gap, Math.abs(dx) - (p.width + c.width) / 2); // closest side by side
    // passing: the sign of the distance along the road changes
    const rel = c.z - p.z;
    if (c.rel !== 0 && rel !== 0 && Math.sign(rel) !== Math.sign(c.rel) && !s.ended) {
      if (c.rel > 0) s.passed[s.stage]++;
      if (!c.noNear && c.gap >= 0 && c.gap < limit && p.speed > CFG.score.nearSpeed) nearMiss(s, c, c.gap);
      c.gap = 99; c.noNear = false;
    }
    if (rel !== 0) c.rel = rel;
  }
}

export function step(s, input = {}, dt = CFG.dt) {
  s.events = [];
  if (s.ended) return s;
  const p = s.player;
  s.tick++;
  s.time = s.tick * dt;

  const stage = stageAt(s.time, s.duration);
  if (stage !== s.stage) { s.stage = stage; emit(s, { type: 'stage', stage }); }

  const wasOff = p.offroad, wasBarrier = p.barrier, z0 = p.z;
  updatePlayer(p, s.track, s.flags, input, dt);
  if (p.offroad && !wasOff) emit(s, { type: 'offroad' });
  if (p.barrier && !wasBarrier) emit(s, { type: 'barrier' });
  s.distance = p.z;
  s.pointAcc += (p.z - z0) * CFG.score.perMetre;
  if (s.pointAcc >= 1) { const n = Math.floor(s.pointAcc); s.pointAcc -= n; s.score += n; }

  stepTraffic(s, dt);
  interact(s);

  if (!s.ended && s.tick >= Math.round(s.duration / dt)) finish(s, 'done');
  return s;
}
