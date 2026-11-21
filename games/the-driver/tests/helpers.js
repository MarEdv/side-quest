// Test helpers: an empty, flat road to build scenarios on, and a way to run steps.
import { createGame, step } from '../src/game.js';
import { CFG } from '../src/config.js';
import { laneX } from '../src/track.js';

export const DT = CFG.dt;

// A game with a flat straight road and no traffic and no spawning: tests add exactly the cars they need.
export function quiet(flags = {}, seed = 1) {
  const s = createGame({ length: 'short', ...flags }, seed);
  for (const seg of s.track.segments) { seg.curve = 0; seg.y = 0; }
  s.cars = [];
  s.spawn = { lane: s.track.lanes === 3 ? [1e9, 1e9, 1e9] : [1e9, 1e9], behind: 1e9 };
  s.events = [];
  return s;
}

// Adds a car at `ahead` metres in front of the player in `lane`.
export function addCar(s, { lane = 1, ahead = 50, speed = 20, kind = 'car', ...o } = {}) {
  const dim = CFG.traffic.sizes[kind];
  const c = {
    id: s.nextId++, kind, color: 0, x: laneX(s.track, lane), lane, z: s.player.z + ahead, speed, cruise: speed,
    width: dim.width, length: dim.length, braking: false, blink: 0, blinkTimer: 0, targetLane: lane, slide: false,
    cooldown: 1e9, rel: ahead, gap: 99, hit: 0, noNear: false, ...o,
  };
  s.cars.push(c);
  return c;
}

// Runs `secs` seconds of steps; returns every event seen.
export function run(s, input, secs) {
  const events = [];
  for (let i = 0, k = Math.round(secs / DT); i < k && !s.ended; i++) { step(s, typeof input === 'function' ? input(s, i) : input); events.push(...s.events); }
  return events;
}
export const ofType = (events, type) => events.filter((e) => e.type === type);
