// Test helpers: an empty, quiet train to build scenarios on, and a way to run steps.
import { createGame, step } from '../src/game.js';
import { CFG } from '../src/config.js';

export const DT = CFG.dt;

// A game with nobody aboard and no offer coming: tests add exactly the passengers they need.
export function quiet(flags = {}, seed = 1) {
  const s = createGame({ trip: 'normal', ...flags }, seed);
  s.passengers = []; s.seatOwner.fill(null); s.followers = [];
  s.quests.timer = 1e9; s.events = [];
  return s;
}

let n = 0;
export function addP(s, o = {}) {
  const p = {
    id: s.nextId++, name: o.name || `P${++n}`, dest: s.route.last, seat: null, spot: null, x: 0, following: false,
    need: null, pending: null, nextNeed: 1e9, seatCounted: true, stress: 0, ticket: true, noTicket: false,
    role: null, complaints: 0, boarded: 0, ...o,
  };
  if (o.seat != null) { s.seatOwner[o.seat] = p.id; p.x = s.train.seats[o.seat].x; p.spot = null; }
  s.passengers.push(p);
  return p;
}

// Runs `secs` seconds of steps with the same input; returns every event seen.
export function run(s, input, secs) {
  const events = [];
  for (let i = 0, k = Math.round(secs / DT); i < k && !s.ended; i++) { step(s, typeof input === 'function' ? input(s, i) : input); events.push(...s.events); }
  return events;
}

export const press = (s, input = {}) => { step(s, { actionPressed: true, ...input }); return s.events; };
export const types = (events) => events.map((e) => e.type);
export const ofType = (events, type) => events.filter((e) => e.type === type);
