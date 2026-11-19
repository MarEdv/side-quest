// The game: createGame(flags, seed) builds the state, step(state, input, dt) advances it by one fixed step (D7, D8).
// Pure and deterministic: all randomness comes from ONE kit createRng(seed) kept in state.rng (non-enumerable, so
// JSON.stringify(state) skips it); no Date or Math.random. Units are in config.js (x in metres along the train).
//
// input (a plain object per step; missing fields are false / null):
//   { left, right,            held: walk along the aisle
//     action,                 held: timed actions (tickets, questions, radio, talking)
//     actionPressed,          true on the step the action went down (edge): instant actions (hand over, lead, seat,
//                             café counter, pick up). `actionPressed` implies `action`.
//     pick,                   null | 'coffee' | 'snack' | 'water' | 'none': choose at the café counter ('none' puts back)
//     accept, decline }       the pending radio offer (edge). Pause is not handled here: the caller stops stepping.
//
// state (plain data; see the field comments in createGame):
//   seed, flags, time, tick, ended, summary, score, stats, train, route, attendant, carried, followers, passengers,
//   seatOwner, picker, hold, quests, events
// state.events holds the events of the LAST step only (cleared at the start of each step); a caller that runs several
// steps per frame must collect them after every step. Event types: station, depart, slip, stopStart, stopEnd (a rescue stop that is no longer possible: questCancelled only), board,
// alight, need, served, complaint, follow, seated, pickup, picker, radio, offer, offerExpired, questAccepted,
// questDeclined, questCancelled, questProgress, questDone, questFailed, end. Every event also has `at` (state.time).
import { CFG } from './config.js';
import { DEFAULT_FLAGS } from './flags.js';
import { createRng } from './kit/rng.js';
import { buildTrain } from './train.js';
import { createRoute, stepRoute } from './route.js';
import { emit, difficultyOf, setCarried } from './core.js';
import { board, boardCount, alight, updatePassengers, moveFollowers, needActions } from './passengers.js';
import { createQuestState, acceptOffer, declineOffer, onArrive, onStopStart, onStopCancel, stopPossible, stepQuests, questActions } from './quests.js';
import { clampX } from './train.js';

export const STATE_VERSION = 1;
const ITEMS = ['coffee', 'snack', 'water'];

export function createGame(flags = DEFAULT_FLAGS, seed = null) {
  flags = { ...DEFAULT_FLAGS, ...flags };
  seed = seed ?? flags.seed ?? 1;
  const rng = createRng(seed);
  const train = buildTrain(flags.cars);
  const s = {
    version: STATE_VERSION, seed, flags, time: 0, tick: 0, ended: false, summary: null, score: 0,
    stats: { carried: 0, calm: 0, complaints: 0, served: 0, questsDone: 0, questsFailed: 0, questsDeclined: 0, potential: 0 },
    train,
    route: null,                  // { stations, phase, at, timer, legDur, delay, stop, ... } (route.js)
    attendant: { x: train.counterX, facing: 1, moving: false },
    carried: null,                // null | 'coffee' | 'snack' | 'water' | 'kit' | 'bag'
    followers: [],                // passenger ids, nearest first
    passengers: [], seatOwner: train.seats.map(() => null), nextId: 1,
    picker: { open: false },      // the café picker
    hold: null,                   // { key, kind, pid, t, dur, progress } while a timed action runs
    quests: null,                 // { timer, offer, active, nextId } (quests.js)
    events: [],
  };
  Object.defineProperty(s, 'rng', { value: rng, enumerable: false, writable: true });
  s.route = createRoute(flags, rng);
  s.quests = createQuestState(rng);
  const n = board(s, boardCount(s, 0), 0);
  emit(s, { type: 'station', station: 0, name: s.route.stations[0], boarded: n, alighted: 0 });
  return s;
}

// ---- stars and the end

export function starsFor(score, potential) {
  const ratio = potential > 0 ? Math.min(1, score / potential) : 0;
  return 1 + CFG.stars.filter((x) => ratio >= x).length;
}

function finish(s) {
  s.ended = true; s.hold = null; s.picker.open = false;
  for (const q of [...s.quests.active]) { // nothing may stay open after the last station
    s.quests.active = s.quests.active.filter((x) => x !== q);
    s.score += q.penalty; s.stats.questsFailed++;
    emit(s, { type: 'questFailed', id: q.id, qtype: q.type, reason: 'end', penalty: q.penalty });
  }
  s.quests.offer = null;
  const st = s.stats;
  s.summary = {
    score: s.score, stars: starsFor(s.score, st.potential), potential: st.potential, carried: st.carried,
    calm: st.calm, calmShare: st.carried ? st.calm / st.carried : 0, complaints: st.complaints,
    questsDone: st.questsDone, questsFailed: st.questsFailed, questsDeclined: st.questsDeclined,
    time: s.time, trip: s.flags.trip, difficulty: s.flags.difficulty, seed: s.seed,
  };
  emit(s, { type: 'end', summary: s.summary });
}

// ---- one step

function handleRoute(s, transitions) {
  for (const tr of transitions) {
    if (tr.type === 'depart') emit(s, { type: 'depart', station: tr.station, name: s.route.stations[tr.station] });
    else if (tr.type === 'slip') emit(s, { type: 'slip', seconds: tr.seconds });
    else if (tr.type === 'stopStart') { emit(s, { type: 'stopStart' }); onStopStart(s); }
    else if (tr.type === 'stopCancel') onStopCancel(s);
    else if (tr.type === 'stopEnd') emit(s, { type: 'stopEnd' });
    else if (tr.type === 'arrive') {
      const k = tr.station;
      onArrive(s, k);
      const out = alight(s, k);
      if (k === s.route.last) {
        emit(s, { type: 'station', station: k, name: s.route.stations[k], boarded: 0, alighted: out, last: true });
        finish(s);
        return;
      }
      const n = board(s, boardCount(s, k), k);
      emit(s, { type: 'station', station: k, name: s.route.stations[k], boarded: n, alighted: out });
    }
  }
}

// All actions available at x: the café counter, passengers, quests. Highest priority first.
function actionsAt(s, ax) {
  const A = CFG.attendant, list = [];
  if (Math.abs(ax - s.train.counterX) <= A.reach) {
    list.push({ key: 'counter', kind: 'press', x: s.train.counterX, reach: A.reach, prio: 30, stress: 0, pid: null,
      run: () => { s.picker.open = !s.picker.open; emit(s, { type: 'picker', open: s.picker.open }); } });
  }
  list.push(...needActions(s, ax), ...questActions(s, ax));
  return list
    .filter((c) => Math.abs(c.x - ax) <= c.reach)
    .sort((a, b) => b.prio - a.prio || b.stress - a.stress || Math.abs(a.x - ax) - Math.abs(b.x - ax) || (a.key < b.key ? -1 : 1));
}

function doActions(s, inp, dt) {
  const ax = s.attendant.x;
  const list = actionsAt(s, ax);
  if (inp.actionPressed) {
    const c = list.find((x) => x.kind === 'press');
    if (c) { s.hold = null; c.run(); return; }
  }
  const h = inp.action && !s.attendant.moving ? list.find((x) => x.kind === 'hold') : null;
  if (!h) { s.hold = null; return; }
  if (!s.hold || s.hold.key !== h.key) s.hold = { key: h.key, kind: h.key.split(':')[0], pid: h.pid, t: 0, dur: h.dur, progress: 0 };
  s.hold.t += dt;
  s.hold.progress = Math.min(1, s.hold.t / s.hold.dur);
  if (s.hold.t >= s.hold.dur) { s.hold = null; h.run(); }
}

export function step(s, input = {}, dt = CFG.dt) {
  s.events = [];
  if (s.ended) return s;
  const inp = { ...input };
  inp.action = !!(inp.action || inp.actionPressed);
  s.time += dt; s.tick++;

  if (inp.accept) acceptOffer(s);
  else if (inp.decline) declineOffer(s);

  // walking
  const a = s.attendant, dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  a.moving = dir !== 0;
  if (dir) { a.facing = dir; a.x = clampX(s.train, a.x + dir * CFG.attendant.speed * dt); }
  const atCounter = Math.abs(a.x - s.train.counterX) <= CFG.attendant.reach;
  if (s.picker.open && !atCounter) { s.picker.open = false; emit(s, { type: 'picker', open: false }); }

  // the café counter
  if (atCounter && inp.pick) {
    if (inp.pick === 'none') { setCarried(s, null); s.picker.open = false; }
    else if (ITEMS.includes(inp.pick)) { setCarried(s, inp.pick); s.picker.open = false; emit(s, { type: 'pickup', item: inp.pick }); }
  }

  doActions(s, inp, dt);
  handleRoute(s, stepRoute(s.route, dt, s.rng, difficultyOf(s), () => stopPossible(s)));
  if (s.ended) return s;
  updatePassengers(s, dt);
  moveFollowers(s, dt);
  stepQuests(s, dt);
  return s;
}
