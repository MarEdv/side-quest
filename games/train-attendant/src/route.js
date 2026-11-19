// The route and the clock of the trip (T-2, T-4): stations, the leg / dwell / stop phases, the delay. Pure.
// route = { stations, last, phase: 'dwell' | 'leg' | 'stop', at, timer, legDur, delay, stop }
// `at` is the station the train is at (dwell) or last left (leg / stop); the next station is at + 1.
import { CFG } from './config.js';

// Fictional names, one list for both languages (A-1).
export const STATION_NAMES = Object.freeze([
  'Alderwick', 'Birchmere', 'Cinderlow', 'Dunmere', 'Eastholm', 'Fernlow', 'Gullcross', 'Hollowfen', 'Ironwater',
  'Junebrook', 'Kettlebrae', 'Larkmoor', 'Mossgate', 'Northwend', 'Oakenholt', 'Pebbleford',
]);

// Picks `n` distinct names in a seeded order.
export function pickStations(rng, n) {
  const pool = [...STATION_NAMES];
  const out = [];
  while (out.length < n) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  return out;
}

export function createRoute(flags, rng) {
  const trip = CFG.trips[flags.trip] || CFG.trips.normal;
  return {
    stations: pickStations(rng, trip.stations), last: trip.stations - 1, nominal: trip.leg,
    phase: 'dwell', at: 0, timer: 0, legDur: trip.leg, delay: 0, stop: null, stopTimer: 0,
  };
}

export const nextStation = (route) => (route.phase === 'dwell' ? route.at : route.at + 1);
export const legProgress = (route) => (route.phase === 'dwell' ? 0 : Math.min(1, route.timer / route.legDur));

// Seconds until the train arrives at station k (a station ahead), counting a pending rescue stop.
export function eta(route, k) {
  const stopOn = (l) => { const s = route.stop; return s && !s.started && !s.done && s.leg === l ? CFG.quests.rescue.stop : 0; };
  let t, l = route.at;
  if (route.phase === 'dwell') {
    if (k <= route.at) return 0;
    t = CFG.dwell - route.timer;
  } else {
    t = route.legDur - route.timer + (route.phase === 'stop' ? Math.max(0, CFG.quests.rescue.stop - route.stopTimer) : stopOn(l));
    if (k <= route.at + 1) return Math.max(0, t);
    t += CFG.dwell; l += 1;
  }
  for (;;) {
    t += route.nominal + stopOn(l);
    if (l + 1 >= k) return Math.max(0, t);
    t += CFG.dwell; l += 1;
  }
}

// Plans the rescue stop on the leg that leaves station `leg`.
export function planStop(route, leg) {
  route.stop = { leg, at: CFG.quests.rescue.stopAt, started: false, done: false };
}

// Advances the clock. Returns the transitions that happened, in order:
// { type: 'depart', station } | { type: 'slip', seconds } | { type: 'stopStart' } | { type: 'stopEnd' } | { type: 'stopCancel' }
// | { type: 'arrive', station }. `canStop()` is asked when a planned rescue stop is due: false cancels the stop (no stop, no
// delay) and the plan is cleared. A finished stop is cleared too, so a later rescue can be planned (D27).
export function stepRoute(route, dt, rng, diff, canStop = () => true) {
  const out = [];
  if (route.phase === 'dwell') {
    route.timer += dt;
    if (route.timer >= CFG.dwell) {
      route.delay = Math.max(0, route.delay - CFG.dwellRecover);
      out.push({ type: 'depart', station: route.at });
      route.phase = 'leg'; route.timer = 0; route.legDur = route.nominal;
      if (rng.chance(diff.slipChance)) {
        const seconds = rng.int(5, diff.slipMax);
        route.legDur += seconds; route.delay += seconds;
        out.push({ type: 'slip', seconds });
      }
    }
  } else if (route.phase === 'stop') {
    route.stopTimer += dt;
    if (route.stopTimer >= CFG.quests.rescue.stop) {
      route.phase = 'leg'; route.stopTimer = 0; route.stop = null;
      out.push({ type: 'stopEnd' });
    }
  } else {
    route.timer += dt;
    const s = route.stop;
    const due = s && !s.started && s.leg === route.at && route.timer >= route.legDur * s.at;
    if (due && !canStop()) {
      route.stop = null;
      out.push({ type: 'stopCancel' });
    } else if (due) {
      s.started = true; route.phase = 'stop'; route.stopTimer = 0; route.delay += CFG.quests.rescue.delay;
      out.push({ type: 'stopStart' });
    } else if (route.timer >= route.legDur) {
      route.at += 1; route.phase = 'dwell'; route.timer = 0;
      out.push({ type: 'arrive', station: route.at });
    }
  }
  return out;
}
