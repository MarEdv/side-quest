import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, levelById, levelIndex, nextLevel, levelFlags, levelProblems, isUnlocked, unlockedCount } from '../src/levels.js';
import { DEFAULT_FLAGS, parseFlagValue } from '../src/config.js';
import { GAMEPLAY_FLAGS, CONTROL_FLAGS, resolveFlags } from '../src/settings.js';
import { createScores } from '../src/scores.js';
import { createStorage } from '../src/storage.js';
import { createGame, update } from '../src/game.js';
import { runMany } from '../tools/level-bot.mjs';
import { NO_INPUT } from './helpers.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };

test('four levels with unique ids, names, one-line briefings and valid gameplay flags', () => {
  assert.equal(LEVELS.length, 4);
  assert.deepEqual(LEVELS.map((l) => l.name), ['Saturday Morning', 'Honey-Do List', 'Eyes Everywhere', 'The Inspection']);
  assert.equal(new Set(LEVELS.map((l) => l.id)).size, 4);
  for (const l of LEVELS) {
    assert.ok(l.id.length <= 40 && l.name && l.briefing && !l.briefing.includes('\n'), l.id);
    assert.deepEqual(levelProblems(l), []);
    for (const [k, v] of Object.entries(l.flags)) { assert.ok(GAMEPLAY_FLAGS.includes(k), k); assert.equal(parseFlagValue(k, v), v, `${l.id}.${k}`); }
  }
  assert.ok(Object.isFrozen(LEVELS) && Object.isFrozen(LEVELS[0].flags));
});

test('levelProblems reports a control flag, an unknown flag and an invalid value', () => {
  assert.equal(levelProblems({ id: 'x', flags: { sound: false, bogus: 1, dayLength: 5, wifeMode: 'hybrid' } }).length, 3);
});

test('level definitions follow the design (L-2)', () => {
  const [a, b, c, d] = LEVELS.map((l) => levelFlags(l));
  assert.deepEqual([a.wifeMode, a.wifeRoam, a.difficulty, a.maxActiveQuests], ['vision', false, 'easy', 1]);
  assert.ok(a.questInterval > DEFAULT_FLAGS.questInterval - 1 && a.questInterval >= b.questInterval); // relaxed timing
  assert.deepEqual([b.wifeMode, b.difficulty, b.maxActiveQuests], ['random', 'normal', 2]);
  assert.deepEqual([c.wifeMode, c.wifeRoam, c.difficulty, c.maxActiveQuests], ['vision', true, 'normal', 2]);
  assert.ok(c.visionRange > DEFAULT_FLAGS.visionRange && c.questInterval < b.questInterval);
  assert.deepEqual([d.wifeMode, d.difficulty, d.maxActiveQuests], ['hybrid', 'hard', 3]);
  assert.ok(d.dayLength < c.dayLength);
});

test('flag composition: gameplay from the level, control from settings, URL gameplay ignored, unlisted flags are defaults', () => {
  const saved = { difficulty: 'hard', dayLength: 30, maxActiveQuests: 5, wifeMode: 'random', sound: false, touch: 'on', touchScheme: 'tap', showVisionCone: false };
  const r = resolveFlags(DEFAULT_FLAGS, saved, '?wifeMode=hybrid&dayLength=999&visionRange=60&touch=off&debug=0');
  const lvl = LEVELS[0];
  const f = levelFlags(lvl, r.flags);
  for (const k of CONTROL_FLAGS) assert.equal(f[k], r.flags[k], k); // from Settings + URL control flags
  assert.equal(f.touch, 'off'); assert.equal(f.sound, false); assert.equal(f.touchScheme, 'tap'); assert.equal(f.showVisionCone, false);
  for (const [k, v] of Object.entries(lvl.flags)) assert.equal(f[k], v, k); // level wins over saved + URL
  for (const k of GAMEPLAY_FLAGS) if (!(k in lvl.flags) && k !== 'seed') assert.equal(f[k], DEFAULT_FLAGS[k], `${k} is the default, not the saved or URL value`);
  assert.equal(f.visionRange, DEFAULT_FLAGS.visionRange);
  assert.deepEqual(Object.keys(f).sort(), Object.keys(DEFAULT_FLAGS).sort());
  // Same result for two players with different settings except the control flags.
  const other = levelFlags(lvl, resolveFlags(DEFAULT_FLAGS, { difficulty: 'easy', wifeRoam: false }, '').flags);
  for (const k of GAMEPLAY_FLAGS) assert.equal(other[k], f[k], k);
});

test('flag composition: seed is random unless debug is on', () => {
  const lvl = LEVELS[1];
  assert.equal(levelFlags(lvl, { ...DEFAULT_FLAGS, seed: 42 }).seed, 'random');
  assert.equal(levelFlags(lvl, { ...DEFAULT_FLAGS, seed: 42, debug: true }).seed, 42);
  assert.equal(levelFlags(lvl, { ...DEFAULT_FLAGS, debug: true }).seed, 'random');
  assert.equal(levelFlags(lvl).debug, false);
});

test('level lookup helpers', () => {
  assert.equal(levelById('l2').name, 'Honey-Do List');
  assert.equal(levelById('nope'), null);
  assert.equal(levelIndex('l3'), 2);
  assert.equal(nextLevel('l1').id, 'l2');
  assert.equal(nextLevel('l4'), null);
  assert.equal(nextLevel('nope'), null);
});

test('unlock logic: level 1 always open, winning N opens N+1, losing does not, never skips ahead', () => {
  assert.equal(unlockedCount({}), 1);
  assert.deepEqual(LEVELS.map((_, i) => isUnlocked(i, {})), [true, false, false, false]);
  assert.equal(isUnlocked(1, { l1: { best: 300, won: false } }), false);
  assert.equal(isUnlocked(1, { l1: { best: 900, won: true } }), true);
  assert.equal(isUnlocked(2, { l1: { best: 900, won: true } }), false);
  assert.equal(isUnlocked(3, { l1: { won: true }, l2: { won: true }, l3: { won: true } }), true);
  assert.equal(unlockedCount({ l1: { won: true }, l2: { won: true }, l3: { won: true }, l4: { won: true } }), 4);
  assert.equal(isUnlocked(-1, {}), true); assert.equal(isUnlocked(9, { l1: { won: true } }), false);
  assert.equal(isUnlocked(1, { l1: { won: 'yes' } }), false); // only a real true counts
});

test('level records feed unlocking: a won level sticks, a later loss does not relock, arcade is independent', () => {
  const sc = createScores(createStorage(mem()));
  assert.equal(unlockedCount(sc.levels()), 1);
  assert.deepEqual(sc.recordLevel('l1', { score: 400, won: false }), { best: 400, won: false, isBest: true });
  assert.equal(isUnlocked(1, sc.levels()), false);
  assert.deepEqual(sc.recordLevel('l1', { score: 900, won: true }), { best: 900, won: true, isBest: true });
  assert.equal(isUnlocked(1, sc.levels()), true);
  assert.deepEqual(sc.recordLevel('l1', { score: 200, won: false }), { best: 900, won: true, isBest: false });
  assert.equal(isUnlocked(1, sc.levels()), true);
  sc.recordArcade({ score: 5000, won: true, date: '2026-01-01T00:00:00Z', summary: 'x' });
  assert.equal(sc.level('l2').won, false);
  assert.equal(sc.arcade().length, 1);
  sc.clearAll();
  assert.equal(unlockedCount(sc.levels()), 1);
});

test('arcade is unchanged: DEFAULT_FLAGS still play the same vision day, and levels never alter DEFAULT_FLAGS', () => {
  assert.deepEqual({ wifeMode: DEFAULT_FLAGS.wifeMode, wifeRoam: DEFAULT_FLAGS.wifeRoam, dayLength: DEFAULT_FLAGS.dayLength, maxActiveQuests: DEFAULT_FLAGS.maxActiveQuests, questInterval: DEFAULT_FLAGS.questInterval, difficulty: DEFAULT_FLAGS.difficulty, visionRange: DEFAULT_FLAGS.visionRange },
    { wifeMode: 'vision', wifeRoam: true, dayLength: 180, maxActiveQuests: 2, questInterval: 20, difficulty: 'normal', visionRange: 320 });
  const run = () => { const s = createGame({ ...DEFAULT_FLAGS, seed: 7 }, 'playing'); for (let i = 0; i < 60 * 60; i++) update(s, NO_INPUT, 1 / 60); return [s.time, s.quests.length, s.stats.questsFailed, s.wife.phase, Math.round(s.harmony * 1000)]; };
  const before = run();
  levelFlags(LEVELS[3], DEFAULT_FLAGS);
  assert.deepEqual(run(), before);
  assert.equal(Object.isFrozen(DEFAULT_FLAGS), true);
});

// L-4: difficulty must rise monotonically. Fast regression guard (20 seeds, ~1 s); the full 200-seed table is in
// DECISIONS D-27 (`node tools/level-balance.mjs`).
test('balance: the bot wins less often and has less slack on every later level (L-4)', () => {
  const r = LEVELS.map((l) => runMany(levelFlags(l), 20, 1));
  for (let i = 1; i < r.length; i++) {
    assert.ok(r[i].winRate <= r[i - 1].winRate, `win rate L${i + 1} ${r[i].winRate} <= L${i} ${r[i - 1].winRate}`);
    assert.ok(r[i].slackFrac < r[i - 1].slackFrac, `slack L${i + 1} ${r[i].slackFrac.toFixed(3)} < L${i} ${r[i - 1].slackFrac.toFixed(3)}`);
  }
  assert.ok(r[0].winRate >= 0.95, `L1 comfortably winnable: ${r[0].winRate}`);
  assert.ok(r[3].winRate >= 0.3, `L4 still possible: ${r[3].winRate}`);
}, { timeout: 15000 });
