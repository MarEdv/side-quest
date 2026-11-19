import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, starsFor } from '../src/game.js';
import { CFG } from '../src/config.js';
import { quiet, addP, run, press, ofType, types } from './helpers.js';

test('createGame: state is plain data and says what the renderer needs', () => {
  const s = createGame({ trip: 'short', cars: 2 }, 7);
  const json = JSON.parse(JSON.stringify(s));
  assert.deepEqual(Object.keys(json).sort(), Object.keys(s).sort());
  for (const k of ['train', 'route', 'attendant', 'carried', 'followers', 'passengers', 'picker', 'hold', 'quests', 'events', 'stats', 'score', 'ended', 'summary', 'flags', 'seatOwner']) assert.ok(k in s, k);
  assert.equal(s.route.stations.length, 4);
  assert.equal(s.train.seats.length, 40);
  assert.equal(s.attendant.x, s.train.counterX);
  assert.equal(s.ended, false);
  assert.equal(s.seed, 7);
  assert.equal(Object.keys(s).includes('rng'), false);
  assert.equal(typeof s.rng.next(), 'number');
  assert.equal(createGame({}, null).seed, 1);
  assert.equal(createGame({ seed: 12 }).seed, 12);
});

test('events belong to the last step only', () => {
  const s = quiet();
  s.events = [{ type: 'old' }];
  step(s, {});
  assert.deepEqual(s.events, []);
  const g = createGame({}, 3);
  assert.equal(g.events[0].type, 'station');
  step(g, {});
  assert.equal(ofType(g.events, 'station').length, 0);
});

test('walking: speed, direction, clamped to the train; both keys cancel', () => {
  const s = quiet();
  const x0 = s.attendant.x;
  run(s, { right: true }, 1);
  assert.ok(Math.abs(s.attendant.x - (x0 + CFG.attendant.speed)) < 0.05);
  assert.equal(s.attendant.facing, 1);
  run(s, { left: true }, 1);
  assert.equal(s.attendant.facing, -1);
  run(s, { left: true }, 20);
  assert.equal(s.attendant.x, 0);
  run(s, { right: true }, 30);
  assert.equal(s.attendant.x, s.train.length);
  const before = s.attendant.x - 1;
  s.attendant.x = before;
  step(s, { left: true, right: true });
  assert.equal(s.attendant.x, before);
  assert.equal(s.attendant.moving, false);
});

test('café counter: the action opens the picker, 1/2/3 pick, 0 puts back, walking away closes it', () => {
  const s = quiet();
  assert.equal(s.picker.open, false);
  const ev = press(s);
  assert.equal(s.picker.open, true);
  assert.deepEqual(ofType(ev, 'picker').map((e) => e.open), [true]);
  step(s, { pick: 'snack' });
  assert.equal(s.carried, 'snack');
  assert.equal(s.picker.open, false);
  press(s);
  step(s, { pick: 'water' });
  assert.equal(s.carried, 'water');
  step(s, { pick: 'none' });
  assert.equal(s.carried, null);
  press(s);
  assert.equal(s.picker.open, true);
  run(s, { right: true }, 0.5);
  assert.equal(s.picker.open, false);
  step(s, { pick: 'coffee' }); // out of reach of the counter
  assert.equal(s.carried, null);
  s.attendant.x = s.train.counterX;
  step(s, { pick: 'coffee' }); // allowed without the picker, at the counter
  assert.equal(s.carried, 'coffee');
  step(s, { pick: 'tea' });
  assert.equal(s.carried, 'coffee');
});

test('a held action does not repeat instant actions; only the edge counts', () => {
  const s = quiet();
  step(s, { action: true });
  assert.equal(s.picker.open, false);
  step(s, { action: true, actionPressed: true });
  assert.equal(s.picker.open, true);
  step(s, { action: true });
  assert.equal(s.picker.open, true);
});

test('stars follow score / potential; negative scores are 1 star', () => {
  assert.equal(starsFor(-500, 1000), 1);
  assert.equal(starsFor(0, 0), 1);
  assert.equal(starsFor(5000, 1000), 5, 'a ratio above 1 is clamped');
  CFG.stars.forEach((cut, i) => { // the cut-offs in config.js give 2..5 stars
    assert.equal(starsFor(Math.round(cut * 1000) - 1, 1000), i + 1);
    assert.equal(starsFor(Math.round(cut * 1000), 1000), i + 2);
  });
  assert.equal(starsFor(2000, 1000), 5);
});

test('end of the trip: everybody gets off, the summary has score, stars, calm share, quests', () => {
  const s = createGame({ trip: 'short' }, 9);
  const ev = run(s, {}, 600);
  assert.equal(s.ended, true);
  assert.equal(s.route.at, s.route.last);
  assert.equal(s.passengers.length, 0);
  assert.equal(s.seatOwner.every((o) => o === null), true);
  const end = ofType(ev, 'end');
  assert.equal(end.length, 1);
  const m = s.summary;
  assert.equal(end[0].summary, m);
  assert.deepEqual(Object.keys(m).sort(), ['calm', 'calmShare', 'carried', 'complaints', 'difficulty', 'potential', 'questsDeclined', 'questsDone', 'questsFailed', 'score', 'seed', 'stars', 'time', 'trip'].sort());
  assert.equal(m.score, s.score);
  assert.ok(m.stars >= 1 && m.stars <= 5);
  assert.equal(m.carried, s.stats.carried);
  assert.ok(m.carried > 20);
  assert.ok(m.calmShare >= 0 && m.calmShare <= 1);
  // stepping after the end changes nothing
  const copy = JSON.stringify(s);
  step(s, { right: true });
  assert.equal(JSON.stringify(s), copy.replace(/"events":\[[^\]]*\]/, '"events":[]'));
  assert.equal(s.events.length, 0);
});

test('the trip length follows the flag: short 4 stations, normal 6, long 8 (time in game seconds)', () => {
  const dur = {};
  for (const trip of ['short', 'normal', 'long']) {
    const s = createGame({ trip }, 5);
    run(s, {}, 2000);
    assert.equal(s.ended, true);
    dur[trip] = s.time;
  }
  assert.ok(dur.short > 3 * 45 + 3 * 8 && dur.short < 3 * 45 + 3 * 8 + 3 * 15 + 1);
  assert.ok(dur.normal > 5 * 60 && dur.long > dur.normal);
});

test('a trip always reaches the last station, whatever the player does (S-4)', () => {
  for (const difficulty of ['easy', 'hard']) {
    const s = createGame({ trip: 'short', difficulty, quests: 'assign' }, 21);
    run(s, (st, i) => ({ left: i % 400 < 200, right: i % 400 >= 200, action: i % 7 < 3, actionPressed: i % 50 === 0, pick: i % 300 === 0 ? 'coffee' : null, accept: i % 90 === 0 }), 600);
    assert.equal(s.ended, true);
  }
});

test('scoring: points for served needs, minus complaints and lost fares, and potential tracks what was on offer', () => {
  const s = createGame({ trip: 'short' }, 2);
  assert.ok(s.stats.potential >= s.passengers.length * (CFG.points.ticket + CFG.points.calm));
  const q = quiet();
  const p = addP(q, { seat: 0, need: 'question' });
  q.attendant.x = p.x;
  run(q, { action: true }, 1.3);
  assert.equal(q.score, CFG.points.question);
  assert.equal(q.stats.served, 1);
});

// ---- determinism (D7)

const script = (i) => ({
  left: i % 500 > 250, right: i % 500 <= 250 && i % 3 !== 0, action: i % 11 < 6, actionPressed: i % 41 === 0,
  pick: i % 230 === 0 ? ['coffee', 'snack', 'water', 'none'][(i / 230) % 4] : null, accept: i % 777 === 5, decline: i % 1303 === 5,
});

function replay(flags, seed, steps) {
  const s = createGame(flags, seed);
  const all = [];
  for (let i = 0; i < steps && !s.ended; i++) { step(s, script(i)); all.push(...s.events); }
  return { s, all };
}

test('same seed and same inputs give an identical state and event stream', () => {
  for (const flags of [{ trip: 'short' }, { trip: 'normal', difficulty: 'hard', stress: 'contagious' }, { trip: 'long', cars: 4, quests: 'assign' }]) {
    const a = replay(flags, 33, 60 * 240), b = replay(flags, 33, 60 * 240);
    assert.equal(JSON.stringify(a.s), JSON.stringify(b.s));
    assert.equal(JSON.stringify(a.all), JSON.stringify(b.all));
    assert.equal(a.s.rng.next(), b.s.rng.next()); // the generators are in the same place
    assert.ok(a.all.length > 20);
  }
});

test('a different seed gives a different trip', () => {
  const a = replay({ trip: 'short' }, 1, 3000), b = replay({ trip: 'short' }, 2, 3000);
  assert.notEqual(JSON.stringify(a.s.passengers), JSON.stringify(b.s.passengers));
  assert.notDeepEqual(a.s.route.stations, b.s.route.stations);
});

test('the state survives a JSON round trip: stepping the copy matches stepping the original', () => {
  const a = replay({ trip: 'short' }, 8, 1800).s;
  const b = JSON.parse(JSON.stringify(a));
  Object.defineProperty(b, 'rng', { value: a.rng, enumerable: false, writable: true }); // the generator is not data
  const a2 = structuredClone(a);
  assert.equal(JSON.stringify(b), JSON.stringify(a2));
});

test('the logic never touches the clock or Math.random', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  for (const f of readdirSync(new URL('../src/', import.meta.url)).filter((x) => x.endsWith('.js'))) {
    if (['main.js', 'render.js', 'input.js', 'ui.js', 'audio.js'].includes(f)) continue;
    const code = readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /Math\.random|Date\.now|new Date|performance\.now/, f);
  }
});
