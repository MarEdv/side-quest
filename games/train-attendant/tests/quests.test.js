import test from 'node:test';
import assert from 'node:assert/strict';
import { step, createGame } from '../src/game.js';
import { CFG } from '../src/config.js';
import { questKey, doneKey } from '../src/quests.js';
import { STRINGS } from '../src/i18n.js';
import { quiet, addP, run, press, ofType, types } from './helpers.js';

// Puts the train mid-leg 0 → 1 (so offers can come) with a rider list the test controls.
function riding(flags = {}, seed = 1) {
  const s = quiet(flags, seed);
  s.route.phase = 'leg'; s.route.at = 0; s.route.timer = 5; s.route.legDur = 60;
  return s;
}
const offerOf = (s, type) => { s.quests.offer = { id: s.quests.nextId++, type, expires: 15, reward: CFG.quests[type].reward, penalty: CFG.quests[type].penalty, ...extra(s, type) }; return s.quests.offer; };
function extra(s, type) { return s.__extra?.[type] || {}; }
const accept = (s) => { step(s, { accept: true }); return s.events; };

// ---- offers

test('offers come every 30-45 s of travel, not while stopped at a station', () => {
  const s = riding({}, 3);
  s.quests.timer = 30;
  for (let i = 0; i < 5; i++) addP(s, { seat: i, dest: 3 });
  s.passengers.forEach((p) => { p.nextNeed = 1e9; });
  const ev = run(s, {}, 29.9);
  assert.equal(ofType(ev, 'offer').length, 0);
  const ev2 = run(s, {}, 0.3);
  assert.equal(ofType(ev2, 'offer').length, 1);
  assert.ok(s.quests.offer);
  // dwelling: the clock stands still
  const d = quiet(); d.quests.timer = 1;
  addP(d, { seat: 0, dest: 3 });
  run(d, {}, 5);
  assert.equal(d.quests.offer, null);
});

test('the gap to the next offer is 30-45 s (seeded)', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = riding({}, seed);
    s.quests.offer = { id: 1, type: 'sick', expires: 15, reward: 1, penalty: 0 };
    step(s, { decline: true });
    assert.ok(s.quests.timer >= 30 && s.quests.timer <= 45, `${s.quests.timer}`);
  }
});

test('an ignored offer expires after 15 s and counts as declined; declining costs nothing', () => {
  const s = riding();
  addP(s, { seat: 0, dest: 3 });
  offerOf(s, 'sick'); s.quests.offer.pid = s.passengers[0].id;
  const ev = run(s, {}, 14.8);
  assert.equal(ofType(ev, 'offerExpired').length, 0);
  assert.ok(s.quests.offer);
  assert.equal(ofType(run(s, {}, 0.4), 'offerExpired').length, 1);
  assert.equal(s.quests.offer, null);
  assert.equal(s.stats.questsDeclined, 1);
  offerOf(s, 'sick');
  const sc = s.score;
  assert.equal(ofType((step(s, { decline: true }), s.events), 'questDeclined').length, 1);
  assert.equal(s.stats.questsDeclined, 2);
  assert.equal(s.score, sc);
  assert.equal(s.quests.active.length, 0);
});

test('at most 2 quests are active: no offer comes with the cap full', () => {
  const s = riding();
  for (let i = 0; i < 8; i++) addP(s, { seat: i, dest: 4 });
  s.passengers.forEach((p) => { p.nextNeed = 1e9; });
  s.quests.active = [{ id: 90, type: 'sick', stage: 'fetch', goal: 'x', vars: {}, penalty: 0, reward: 0, remaining: 1e9 }, { id: 91, type: 'sick', stage: 'fetch', goal: 'x', vars: {}, penalty: 0, reward: 0, remaining: 1e9 }];
  s.quests.timer = 0.01;
  const ev = run(s, {}, 3);
  assert.equal(ofType(ev, 'offer').length, 0);
  assert.equal(s.quests.offer, null);
});

test('quests=assign accepts every offer at once', () => {
  const s = riding({ quests: 'assign' }, 4);
  for (let i = 0; i < 8; i++) addP(s, { seat: i, dest: 4 });
  s.passengers.forEach((p) => { p.nextNeed = 1e9; });
  s.quests.timer = 0.01;
  const ev = run(s, {}, 0.2);
  assert.equal(ofType(ev, 'offer').length, 1);
  assert.equal(ofType(ev, 'questAccepted').length, 1);
  assert.equal(s.quests.offer, null);
  assert.equal(s.quests.active.length, 1);
});

test('every quest has the texts it needs, with the variables its vars hold', () => {
  for (const type of ['rescue', 'connection', 'nervous', 'lost', 'sick']) {
    for (const kind of ['offer', 'failed', 'title']) assert.ok(STRINGS.en[questKey(type, kind)]);
    assert.ok(STRINGS.en[doneKey(type, 'done')]);
  }
  assert.equal(doneKey('connection', 'rebooked'), 'q_connection_rebooked');
});

// ---- sick

function sickGame() {
  const s = riding();
  const p = addP(s, { seat: 0, dest: 4, name: 'Siv' });
  offerOf(s, 'sick'); Object.assign(s.quests.offer, { pid: p.id, vars: { name: 'Siv' } });
  accept(s);
  return { s, p, q: s.quests.active[0] };
}

test('sick: fetch the kit from the cab and bring it within 45 s', () => {
  const { s, p, q } = sickGame();
  assert.equal(q.stage, 'fetch'); assert.ok(Math.abs(q.remaining - 45) < 0.1);
  assert.equal(p.role, 'sick');
  assert.ok(p.stress > 15, 'a sick passenger is stressed');
  s.attendant.x = s.train.cab.x;
  press(s);
  assert.equal(s.carried, 'kit'); assert.equal(q.stage, 'deliver');
  s.attendant.x = p.x;
  const sc = s.score;
  const ev = press(s);
  assert.equal(ofType(ev, 'questDone')[0].qtype, 'sick');
  assert.equal(s.score, sc + CFG.quests.sick.reward);
  assert.equal(s.carried, null);
  assert.equal(s.quests.active.length, 0);
  assert.equal(s.stats.questsDone, 1);
  assert.equal(p.role, null);
});

test('sick: failing after 45 s costs points', () => {
  const { s } = sickGame();
  const ev = run(s, {}, 45.5);
  const f = ofType(ev, 'questFailed')[0];
  assert.equal(f.qtype, 'sick'); assert.equal(f.reason, 'late');
  assert.equal(f.penalty, CFG.quests.sick.penalty);
  assert.equal(s.score, CFG.quests.sick.penalty + CFG.points.complaint * s.stats.complaints);
  assert.equal(s.stats.questsFailed, 1);
  assert.equal(s.quests.active.length, 0);
});

test('sick: putting the kit down for a coffee sends the quest back to fetching', () => {
  const { s, q } = sickGame();
  s.attendant.x = s.train.cab.x; press(s);
  s.attendant.x = s.train.counterX;
  step(s, { pick: 'coffee' });
  assert.equal(s.carried, 'coffee'); assert.equal(q.stage, 'fetch');
});

// ---- connection

function connGame(delay = 0) {
  const s = riding();
  const p = addP(s, { seat: 0, dest: 2, name: 'Calle' });
  s.route.delay = delay;
  offerOf(s, 'connection'); Object.assign(s.quests.offer, { pid: p.id, vars: { name: 'Calle', station: s.route.stations[2], platform: 4 } });
  accept(s);
  return { s, p, q: s.quests.active[0] };
}

test('connection: radio from the cab (hold 1.5 s), then tell the passenger the platform', () => {
  const { s, p, q } = connGame();
  assert.equal(q.stage, 'radio'); assert.equal(p.role, 'connection');
  s.attendant.x = s.train.cab.x;
  run(s, { action: true }, 1.4);
  assert.equal(q.stage, 'radio');
  run(s, { action: true }, 0.2);
  assert.equal(q.stage, 'tell');
  s.attendant.x = p.x;
  const sc = s.score;
  const ev = press(s);
  const done = ofType(ev, 'questDone')[0];
  assert.equal(done.rebooked, false);
  assert.equal(s.score, sc + CFG.quests.connection.reward);
});

test('connection: more than 45 s late when radioing: rebooked for half the reward', () => {
  const { s } = connGame(50);
  s.attendant.x = s.train.cab.x;
  const sc = s.score;
  const ev = run(s, { action: true }, 1.7);
  const done = ofType(ev, 'questDone')[0];
  assert.equal(done.rebooked, true);
  assert.equal(done.kind, 'rebooked');
  assert.equal(s.score - sc, CFG.quests.connection.reward / 2);
});

test('connection: exactly 45 s late still works', () => {
  const { s, q } = connGame(45);
  s.attendant.x = s.train.cab.x;
  run(s, { action: true }, 1.7);
  assert.equal(q.stage, 'tell');
});

test('connection: failing when the train reaches the station first', () => {
  const { s, p } = connGame();
  s.route.timer = s.route.legDur - 0.02; // arrive at station 1; the connection is at 2
  run(s, {}, 0.1);
  assert.equal(s.quests.active.length, 1);
  s.route.phase = 'leg'; s.route.at = 1; s.route.timer = s.route.legDur - 0.02;
  const ev = run(s, {}, 0.1);
  const f = ofType(ev, 'questFailed')[0];
  assert.equal(f.qtype, 'connection'); assert.equal(f.reason, 'station');
  assert.equal(s.stats.questsFailed, 1);
  assert.ok(!s.passengers.includes(p)); // and the passenger got off at their station afterwards
});

// ---- nervous

function nervousGame() {
  const s = riding();
  const p = addP(s, { seat: 0, dest: 4, name: 'Nils', stress: 10 });
  offerOf(s, 'nervous'); Object.assign(s.quests.offer, { pid: p.id, vars: { name: 'Nils', done: 0, n: 3 } });
  accept(s);
  return { s, p, q: s.quests.active[0] };
}

test('nervous: stress jumps to 80 and rises fast; three talks 6 s apart (or water) calm them', () => {
  const { s, p, q } = nervousGame();
  assert.ok(p.stress >= 80);
  const before = p.stress;
  run(s, {}, 2);
  assert.ok(p.stress > before + 1.5, 'rises 3x as fast as an idle passenger (0.9/s)');
  s.attendant.x = p.x;
  run(s, { action: true }, 1.6);
  assert.equal(q.talks, 1);
  assert.equal(q.vars.done, 1);
  // too soon: nothing happens while the 6 s gap runs
  run(s, { action: true }, 3);
  assert.equal(q.talks, 1);
  run(s, { action: true }, 4.7); // 6 s after the first talk the next hold may start (1.5 s)
  assert.equal(q.talks, 2);
  // water counts as a talk (after the gap)
  s.carried = 'water';
  run(s, {}, 6);
  const ev = press(s);
  assert.equal(ofType(ev, 'questDone').length, 1);
  assert.equal(s.carried, null);
  assert.equal(s.stats.questsDone, 1);
});

test('nervous: stress reaching 100 fails the quest and files a complaint', () => {
  const { s, p } = nervousGame();
  p.stress = 99.5;
  const ev = run(s, {}, 1);
  assert.equal(ofType(ev, 'complaint').length, 1);
  const f = ofType(ev, 'questFailed')[0];
  assert.equal(f.reason, 'complaint');
  assert.equal(s.quests.active.length, 0);
});

test('nervous: reaching their station first fails the quest', () => {
  const { s, p, q } = nervousGame();
  p.dest = 1; q.deadlineStation = 1; p.stress = 80;
  s.route.timer = s.route.legDur - 0.02;
  const ev = run(s, {}, 0.1);
  assert.equal(ofType(ev, 'questFailed')[0].reason, 'station');
});

// ---- lost bag

function lostGame() {
  const s = riding();
  const p = addP(s, { seat: 25, dest: 3, name: 'Lisa' }); // a seat in car 3
  offerOf(s, 'lost'); Object.assign(s.quests.offer, { pid: p.id, vars: { name: 'Lisa', car: 1 }, bag: { x: 7.3, car: 0 } });
  accept(s);
  return { s, p, q: s.quests.active[0] };
}

test('lost bag: pick it up in its car, hand it to the owner', () => {
  const { s, p, q } = lostGame();
  s.attendant.x = 20; // the wrong car
  press(s);
  assert.equal(s.carried, null);
  s.attendant.x = 7.3;
  const ev = press(s);
  assert.equal(s.carried, 'bag'); assert.equal(q.stage, 'give');
  assert.equal(ofType(ev, 'pickup')[0].item, 'bag');
  s.attendant.x = p.x;
  const done = ofType(press(s), 'questDone')[0];
  assert.equal(done.qtype, 'lost');
  assert.equal(s.carried, null);
});

test('lost bag: swapping the bag for a coffee puts it back; the owner leaving fails the quest', () => {
  const { s, q } = lostGame();
  s.attendant.x = 7.3; press(s);
  s.attendant.x = s.train.counterX;
  step(s, { pick: 'snack' });
  assert.equal(q.stage, 'find');
  s.route.at = 2; s.route.phase = 'leg'; s.route.timer = s.route.legDur - 0.02;
  const ev = run(s, {}, 0.1);
  assert.equal(ofType(ev, 'questFailed')[0].qtype, 'lost');
  assert.equal(s.stats.questsFailed, 1);
});

// ---- rescue

// Runs until the rescue stop has begun (a slip may lengthen the leg).
function untilStop(s) {
  const seen = [];
  for (let i = 0; i < 60 * 120; i++) { step(s, {}); seen.push(...s.events); if (s.events.some((e) => e.type === 'stopStart')) break; }
  return seen;
}

function rescueGame(n = 7) {
  const s = quiet({}, 2);
  s.route.phase = 'dwell'; s.route.at = 0; s.route.timer = 0; // the leg 0 → 1 will stop
  offerOf(s, 'rescue'); Object.assign(s.quests.offer, { vars: { n, station: s.route.stations[1] } });
  accept(s);
  return { s, q: s.quests.active[0] };
}

test('rescue: the train stops mid-leg for 10 s (+20 s delay), 6-10 passengers board at the front', () => {
  const { s, q } = rescueGame(7);
  assert.equal(q.stage, 'wait'); assert.equal(q.deadlineStation, 1);
  assert.equal(s.route.stop.leg, 0);
  const ev = untilStop(s);
  assert.deepEqual(types(ev).filter((t) => ['depart', 'stopStart', 'board'].includes(t)), ['depart', 'stopStart', 'board']);
  assert.equal(s.route.phase, 'stop');
  const slip = ofType(ev, 'slip')[0]?.seconds || 0;
  assert.ok(Math.abs(s.route.delay - (20 + slip)) < 1e-9);
  assert.equal(q.pids.length, 7);
  assert.equal(q.stage, 'seat');
  for (const id of q.pids) {
    const p = s.passengers.find((x) => x.id === id);
    assert.equal(p.stress >= 60, true);
    assert.equal(p.noTicket, true); assert.equal(p.ticket, true);
    assert.equal(p.seat, null);
    assert.ok(p.x > 28 && p.x < 56, `stands in the front car: ${p.x}`);
  }
  const t0 = s.time;
  const ev2 = run(s, {}, 10.1);
  assert.equal(ofType(ev2, 'stopEnd').length, 1);
  assert.ok(s.time - t0 >= 10);
  assert.equal(s.route.phase, 'leg');
});

test('rescue: leading everyone to a seat completes it and calms them', () => {
  const { s, q } = rescueGame(6);
  untilStop(s);
  assert.equal(q.pids.length, 6);
  const sc = s.score;
  const seats = [];
  // the bot-free way: lead each one by hand, seat them in row 0..
  const rows = s.train.rows;
  let done = false;
  for (let k = 0; k < 6 && !done; k++) {
    const p = s.passengers.find((x) => q.pids.includes(x.id) && x.seat === null && !x.following);
    s.attendant.x = p.x; press(s);
    s.attendant.x = rows[k % 5].x + 0; // row of the first car
    const ev = press(s);
    done = ofType(ev, 'questDone').length > 0;
    seats.push(p.id);
    if (rows[k % 5].seats.every((id) => s.seatOwner[id] !== null)) continue;
  }
  assert.equal(done, true);
  assert.equal(s.stats.questsDone, 1);
  assert.ok(s.score >= sc + CFG.quests.rescue.reward);
  for (const id of q.pids) assert.ok(s.passengers.find((x) => x.id === id).stress < 60);
});

test('rescue: not everyone seated before the next station fails it', () => {
  const { s } = rescueGame(6);
  const ev = run(s, {}, 8 + 75 + 10 + 3);
  const f = ofType(ev, 'questFailed')[0];
  assert.equal(f.qtype, 'rescue'); assert.equal(f.reason, 'late');
  assert.equal(s.stats.questsFailed, 1);
});

test('rescue: with too few free seats the passenger count shrinks, with none it is cancelled', () => {
  const { s } = rescueGame(9);
  for (let i = 0; i < 58; i++) addP(s, { seat: i, dest: 5 });
  s.passengers.forEach((p) => { p.nextNeed = 1e9; });
  const ev = untilStop(s);
  assert.equal(ofType(ev, 'board')[0].n, 2);
  const t = rescueGame(6);
  for (let i = 0; i < 60; i++) addP(t.s, { seat: i, dest: 5 });
  t.s.passengers.forEach((p) => { p.nextNeed = 1e9; });
  const ev2 = untilStop(t.s);
  assert.equal(ofType(ev2, 'questCancelled').length, 1);
  assert.equal(t.s.quests.active.length, 0);
});

test('rescue: cancelled before the stop starts means no stop, no delay and no broken-down train (D27)', () => {
  const { s } = rescueGame(6);
  for (let i = 0; i < 60; i++) addP(s, { seat: i, dest: 5 });
  s.passengers.forEach((p) => { p.nextNeed = 1e9; });
  const ev = [];
  for (let i = 0; i < 60 * 100; i++) { step(s, {}); ev.push(...s.events); if (ofType(s.events, 'arrive').length || s.route.phase === 'stop') break; }
  assert.equal(s.route.phase === 'stop', false);
  assert.equal(ofType(ev, 'stopStart').length, 0);
  assert.equal(ofType(ev, 'stopEnd').length, 0);
  assert.equal(ofType(ev, 'questCancelled').length, 1);
  assert.equal(s.route.stop, null);
  assert.ok(s.route.delay < 20);
});

test('offers: a rescue is only offered when 6-10 passengers fit, and its count is 6-10', () => {
  let seen = new Set();
  for (let seed = 1; seed < 60; seed++) {
    const s = riding({}, seed);
    s.quests.timer = 0.01;
    const ev = run(s, {}, 0.1);
    const o = s.quests.offer;
    if (o && o.type === 'rescue') { assert.ok(o.vars.n >= 6 && o.vars.n <= 10); seen.add(o.vars.n); }
  }
  assert.ok(seen.size >= 3);
});

test('nervous: never offered to a passenger whose ticket is unchecked, so no fare is lost (D24)', () => {
  const s = riding({}, 7);
  addP(s, { seat: 0, dest: 4, ticket: false, need: 'ticket' });
  const b = addP(s, { seat: 1, dest: 4, ticket: true });
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    s.quests.offer = null; s.quests.timer = 0; step(s, {});
    const o = s.quests.offer;
    if (o && o.type === 'nervous') { assert.equal(o.pid, b.id); seen.add(o.pid); }
  }
  assert.equal(seen.size, 1);
});

test('nervous: no quest passenger leaves without a ticket check (seed 7, short trip, quests assigned)', () => {
  const s = createGame({ trip: 'short', quests: 'assign' }, 7);
  const nervous = new Set();
  for (let i = 0; i < 60 * 500 && !s.ended; i++) {
    step(s, {});
    for (const p of s.passengers) if (p.role === 'nervous') { assert.equal(p.ticket, true); nervous.add(p.id); }
    for (const e of s.events) if (e.type === 'alight' && nervous.has(e.id)) assert.equal(e.lostFare, false);
  }
  assert.ok(s.ended);
});

test('rescue: after one rescue ended another can be offered and made in the same trip (D27)', () => {
  let most = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const s = createGame({ trip: 'long', quests: 'assign' }, seed);
    let rescues = 0;
    for (let i = 0; i < 60 * 900 && !s.ended; i++) {
      step(s, {});
      for (const e of s.events) if (e.type === 'stopEnd') rescues++;
      // keep everybody seated and calm so seats free up: the test is about the route, not the play
      if (s.route.phase === 'stop') { for (const p of s.passengers) { p.stress = 0; } }
    }
    most = Math.max(most, rescues);
  }
  assert.ok(most >= 2, `most rescues in one trip: ${most}`);
});
