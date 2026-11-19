import test from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../src/game.js';
import { CFG } from '../src/config.js';
import { quiet, addP, run, press, ofType, types, DT } from './helpers.js';

test('a new game boards the first station and every boarder rides to a later station', async () => {
  const { createGame } = await import('../src/game.js');
  const s = createGame({ trip: 'normal' }, 11);
  assert.ok(s.passengers.length >= 24 && s.passengers.length <= 36, `${s.passengers.length}`);
  for (const p of s.passengers) {
    assert.ok(p.dest >= 1 && p.dest <= s.route.last);
    assert.ok(p.stress >= 0 && p.stress <= 15);
    assert.equal(p.ticket, false);
    assert.equal(p.pending, 'ticket');
    assert.ok(p.seat !== null);
    assert.equal(s.seatOwner[p.seat], p.id);
  }
  assert.equal(s.events[0].type, 'station');
});

test('the ticket bubble shows 1-5 s after boarding; unmet needs raise stress', () => {
  const s = quiet();
  const p = addP(s, { seat: 0, pending: 'ticket', nextNeed: 2, ticket: false });
  run(s, {}, 1.9);
  assert.equal(p.need, null);
  const ev = run(s, {}, 0.3);
  assert.equal(p.need, 'ticket');
  assert.equal(ofType(ev, 'need')[0].need, 'ticket');
  const before = p.stress;
  run(s, {}, 5);
  assert.ok(p.stress > before + 4, `stress ${p.stress}`);
});

test('stress rises per need at the configured rate, faster when standing', () => {
  const sat = quiet(), stood = quiet();
  const a = addP(sat, { seat: 0, need: 'coffee' });
  const b = addP(stood, { need: 'coffee', x: 1, spot: 0 });
  run(sat, {}, 10); run(stood, {}, 10);
  assert.ok(Math.abs(a.stress - CFG.stress.rate.coffee * 10) < 0.5);
  assert.ok(Math.abs(b.stress - CFG.stress.rate.coffee * 10 * CFG.stress.standing) < 0.5);
});

test('delay makes stress rise faster; difficulty scales it', () => {
  const a = quiet(), b = quiet(), c = quiet({ difficulty: 'hard' });
  b.route.delay = 60;
  const pa = addP(a, { seat: 0, need: 'snack' }), pb = addP(b, { seat: 0, need: 'snack' }), pc = addP(c, { seat: 0, need: 'snack' });
  for (const s of [a, b, c]) run(s, {}, 5);
  assert.ok(pb.stress > pa.stress * 1.2);
  assert.ok(Math.abs(pc.stress / pa.stress - 1.3) < 0.05);
});

test('a calm seated passenger without a need relaxes; a standing one slowly tenses', () => {
  const s = quiet();
  const a = addP(s, { seat: 0, stress: 20 });
  const b = addP(s, { x: 1, spot: 0, stress: 20, seatCounted: true });
  s.seatOwner.fill(-1); // no free seat: the standing passenger gets no 'seat' need
  run(s, {}, 5);
  assert.ok(a.stress < 17);
  assert.ok(b.stress > 20 && b.need === null);
});

test('stress 100 files a complaint: -30 points, stress back to 60, the need stays', () => {
  const s = quiet();
  const p = addP(s, { seat: 0, need: 'question', stress: 99 });
  const ev = run(s, {}, 1);
  assert.equal(ofType(ev, 'complaint').length, 1);
  assert.equal(s.stats.complaints, 1);
  assert.equal(s.score, CFG.points.complaint);
  assert.ok(p.stress >= 59 && p.stress < 70);
  assert.equal(p.need, 'question');
  assert.equal(p.complaints, 1);
});

test('contagious stress spreads to neighbours in the same car, solo does not', () => {
  const mk = (stress) => {
    const s = quiet({ stress });
    const hot = addP(s, { seat: 0, stress: 90, need: 'question' });
    const near = addP(s, { seat: 4, stress: 10 });   // row 1, same car, 2 m away
    const far = addP(s, { seat: 12, stress: 10 });    // row 3
    const other = addP(s, { seat: 24, stress: 10 }); // another car
    hot.need = null; hot.stress = 90;
    run(s, {}, 1);
    return { near, far, other };
  };
  const c = mk('contagious'), solo = mk('solo');
  assert.ok(c.near.stress > 10, 'near');
  assert.ok(c.far.stress <= 10);
  assert.ok(c.other.stress <= 10);
  assert.ok(solo.near.stress <= 10);
});

test('checking a ticket takes a 0.6 s hold and scores; the ring shows the progress', () => {
  const s = quiet();
  const p = addP(s, { seat: 0, need: 'ticket', ticket: false, stress: 40 });
  s.attendant.x = p.x;
  run(s, { action: true }, 0.3);
  assert.ok(s.hold && s.hold.kind === 'ticket' && Math.abs(s.hold.progress - 0.5) < 0.1);
  assert.equal(p.need, 'ticket');
  const ev = run(s, { action: true }, 0.4);
  assert.equal(p.ticket, true);
  assert.equal(p.need, null);
  assert.equal(s.score, CFG.points.ticket);
  assert.ok(p.stress <= 40 - CFG.stress.relief + 1);
  const served = ofType(ev, 'served')[0];
  assert.equal(served.need, 'ticket'); assert.equal(served.id, p.id);
});

test('a question takes a 1.2 s hold', () => {
  const s = quiet();
  const p = addP(s, { seat: 0, need: 'question' });
  s.attendant.x = p.x;
  run(s, { action: true }, 1.1);
  assert.equal(p.need, 'question');
  run(s, { action: true }, 0.2);
  assert.equal(p.need, null);
  assert.equal(s.score, CFG.points.question);
});

test('releasing the action or walking away resets the hold', () => {
  const s = quiet();
  const p = addP(s, { seat: 0, need: 'question' });
  s.attendant.x = p.x;
  run(s, { action: true }, 0.8);
  run(s, {}, 0.1);
  assert.equal(s.hold, null);
  run(s, { action: true }, 0.8);
  assert.equal(p.need, 'question');
  run(s, { action: true, right: true }, 0.2); // moving cancels
  assert.equal(s.hold, null);
});

test('the most stressed passenger in reach is served first', () => {
  const s = quiet();
  const calm = addP(s, { seat: 0, need: 'ticket', ticket: false, stress: 10 });
  const hot = addP(s, { seat: 1, need: 'ticket', ticket: false, stress: 70 });
  s.attendant.x = calm.x;
  run(s, { action: true }, 0.7);
  assert.equal(hot.ticket, true);
  assert.equal(calm.ticket, false);
});

test('coffee and snack are handed over instantly, only the right item, only when carried', () => {
  const s = quiet();
  const p = addP(s, { seat: 0, need: 'coffee', stress: 50 });
  s.attendant.x = p.x;
  press(s);
  assert.equal(p.need, 'coffee'); // nothing in hand
  s.carried = 'snack';
  press(s);
  assert.equal(p.need, 'coffee'); // wrong item
  assert.equal(s.carried, 'snack');
  s.carried = 'coffee';
  const ev = press(s);
  assert.equal(p.need, null);
  assert.equal(s.carried, null);
  assert.equal(s.score, CFG.points.coffee);
  assert.equal(ofType(ev, 'served')[0].need, 'coffee');
  assert.ok(p.stress <= 25 + 1);
});

test('a passenger gets a new random need after being served', () => {
  const s = quiet();
  const p = addP(s, { seat: 0, need: 'ticket', ticket: false });
  s.attendant.x = p.x;
  run(s, { action: true }, 0.7);
  assert.equal(p.need, null);
  assert.ok(p.nextNeed >= 55 - 0.5 && p.nextNeed <= 100);
  p.nextNeed = 0.01;
  run(s, {}, 0.1);
  assert.ok(['coffee', 'snack', 'question'].includes(p.need), p.need);
});

test('an action out of reach does nothing', () => {
  const s = quiet();
  const p = addP(s, { seat: 0, need: 'question' });
  s.attendant.x = p.x + 3;
  run(s, { action: true }, 2);
  assert.equal(p.need, 'question');
});

test('boarding when the train is full: the rest stand in a vestibule and get a seat need once one is free', () => {
  const s = quiet();
  s.train.seats.forEach((seat) => addP(s, { seat: seat.id, dest: 5, stress: 0 }));
  s.passengers.forEach((p) => { p.nextNeed = 1e9; });
  // arrive at station 1: the first 60 have dest 5 and stay; the boarders cannot sit
  s.route.phase = 'leg'; s.route.at = 0; s.route.timer = s.route.legDur - 0.01;
  const ev = run(s, {}, 0.05);
  const station = ofType(ev, 'station')[0];
  assert.equal(station.station, 1);
  assert.ok(station.boarded > 10);
  const standing = s.passengers.filter((p) => p.seat === null);
  assert.equal(standing.length, station.boarded);
  for (const p of standing) assert.ok(p.spot !== null && p.dest >= 2);
  assert.ok(standing.every((p) => p.need === null || p.need === 'ticket'));
  // somebody leaves their seat: the standing passengers now need one
  const gone = s.passengers.find((p) => p.seat !== null);
  s.passengers = s.passengers.filter((p) => p !== gone); s.seatOwner[gone.seat] = null;
  standing.forEach((p) => { p.pending = null; p.need = null; });
  run(s, {}, 0.1);
  assert.ok(standing.every((p) => p.need === 'seat'));
});

test('lead and seat: the action on a standing passenger makes them follow, at a row with a free seat they sit', () => {
  const s = quiet();
  const p = addP(s, { x: 1, spot: 0, need: 'seat', stress: 60 });
  s.attendant.x = 1;
  const ev = press(s);
  assert.equal(p.following, true);
  assert.deepEqual(s.followers, [p.id]);
  assert.equal(ofType(ev, 'follow').length, 1);
  // walk to row 0 (x = 3): the follower trails behind
  run(s, { right: true }, 0.4);
  assert.ok(Math.abs(s.attendant.x - 3) < 0.05, `${s.attendant.x}`);
  run(s, {}, 1);
  assert.ok(Math.abs(p.x - (s.attendant.x - CFG.attendant.followGap)) < 0.05);
  // follower is still standing: no free-row press on a vestibule
  s.attendant.x = 3;
  const ev2 = press(s);
  assert.equal(ofType(ev2, 'seated').length, 1);
  assert.equal(p.seat, 0);
  assert.equal(p.following, false);
  assert.equal(s.seatOwner[0], p.id);
  assert.deepEqual(s.followers, []);
  assert.equal(s.score, CFG.points.seat);
  assert.ok(p.stress < 60);
});

test('a full row does not take followers; at most 4 followers at once', () => {
  const s = quiet();
  for (let i = 0; i < 6; i++) addP(s, { x: 1, spot: i, need: 'seat' });
  s.attendant.x = 1;
  for (let i = 0; i < 6; i++) { press(s); }
  assert.equal(s.followers.length, 4);
  for (const id of [0, 1, 2, 3]) addP(s, { seat: id });
  s.attendant.x = s.train.rows[0].x;
  const ev = press(s);
  assert.equal(ofType(ev, 'seated').length, 0);
  assert.equal(s.followers.length, 4);
  s.attendant.x = s.train.rows[1].x;
  assert.equal(ofType(press(s), 'seated').length, 1);
  assert.equal(s.followers.length, 3);
});

test('passengers get off at their station: calm arrival bonus, lost fare for an unchecked ticket', () => {
  const s = quiet();
  addP(s, { seat: 0, dest: 1, stress: 5 });
  addP(s, { seat: 1, dest: 1, stress: 50 });
  addP(s, { seat: 2, dest: 1, stress: 5, ticket: false });
  addP(s, { seat: 3, dest: 4 });
  s.route.phase = 'leg'; s.route.timer = s.route.legDur - 0.01;
  const ev = run(s, {}, 0.05);
  const gone = ofType(ev, 'alight');
  assert.equal(gone.length, 3);
  assert.deepEqual(gone.map((g) => [g.calm, g.lostFare]), [[true, false], [false, false], [true, true]]);
  assert.equal(s.stats.carried, 3);
  assert.equal(s.stats.calm, 2);
  assert.equal(s.score, 2 * CFG.points.calm + CFG.points.lostFare);
  assert.equal(s.seatOwner[0], null);
});

test('a follower who is leading gets off with the rest and leaves the follower list', () => {
  const s = quiet();
  const p = addP(s, { x: 1, spot: 0, dest: 1, need: 'seat' });
  s.attendant.x = 1; press(s);
  s.route.phase = 'leg'; s.route.timer = s.route.legDur - 0.01;
  run(s, {}, 0.05);
  assert.deepEqual(s.followers, []);
  assert.ok(!s.passengers.includes(p));
});
