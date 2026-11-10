import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateInput, rankText, bestText, formatDate, moveFocus } from '../src/uimodel.js';
import { settingsSummary, DEFAULT_FLAGS } from '../src/config.js';
import { createGame, update, startGame, toMenu } from '../src/game.js';
import { mkFlags, NO_INPUT } from './helpers.js';

const all = { up: true, down: true, left: true, right: true, action: true, pause: true, start: true, restart: true, moveX: 1, moveY: 1 };

test('gateInput: nothing reaches the game from the main menu', () => {
  const g = gateInput('title', all);
  assert.ok(Object.values(g).every((v) => v === false || v === 0));
});
test('gateInput: pause only passes pause; end screens only restart; playing drops start/restart', () => {
  assert.deepEqual(Object.entries(gateInput('paused', all)).filter(([, v]) => v).map(([k]) => k), ['pause']);
  assert.deepEqual(Object.entries(gateInput('won', all)).filter(([, v]) => v).map(([k]) => k), ['restart']);
  assert.equal(gateInput('lost', all).action, false);
  const p = gateInput('playing', all);
  assert.equal(p.action, true); assert.equal(p.start, false); assert.equal(p.restart, false); assert.equal(p.moveX, 1);
});

test('rank / best texts', () => {
  assert.equal(rankText({ rank: 1, isBest: true, best: 9 }), 'New high score!');
  assert.equal(rankText({ rank: 3, isBest: false, best: 9 }), '#3 on your board');
  assert.equal(rankText({ rank: null, isBest: false, best: 9 }), '');
  assert.equal(bestText({ rank: 3, isBest: false, best: 9 }), 'Best: 9');
  assert.equal(bestText(null), '');
});

test('formatDate is short and tolerant', () => {
  assert.match(formatDate('2026-11-08T10:00:00Z', 'en-US'), /2026/);
  assert.equal(formatDate('nope'), '');
  assert.equal(formatDate(''), '');
});

test('moveFocus wraps and handles empty/unknown', () => {
  assert.equal(moveFocus(3, 0, 'ArrowDown'), 1);
  assert.equal(moveFocus(3, 2, 'ArrowRight'), 0);
  assert.equal(moveFocus(3, 0, 'ArrowUp'), 2);
  assert.equal(moveFocus(3, -1, 'ArrowDown'), 0);
  assert.equal(moveFocus(3, 1, 'KeyX'), 1);
  assert.equal(moveFocus(0, 0, 'ArrowDown'), -1);
});

test('settingsSummary', () => {
  assert.equal(settingsSummary(DEFAULT_FLAGS), 'vision·roam·normal');
  assert.equal(settingsSummary({ ...DEFAULT_FLAGS, wifeRoam: false, difficulty: 'hard' }), 'vision·patio·hard');
  assert.equal(settingsSummary({ ...DEFAULT_FLAGS, wifeMode: 'random', difficulty: 'easy' }), 'random·easy');
});

test('game carries its summary; startGame / toMenu hand-offs', () => {
  const s = createGame(mkFlags({ difficulty: 'hard' }), 'title');
  assert.equal(s.summary, 'vision·roam·hard');
  startGame(s);
  assert.equal(s.phase, 'playing');
  s.time = 5;
  toMenu(s);
  assert.equal(s.phase, 'title');
  assert.equal(s.time, 0);
  update(s, NO_INPUT, 1 / 60);
  assert.equal(s.phase, 'title');
});

test('startGame keeps held-key edge memory (no instant pause toggle)', () => {
  const s = createGame(mkFlags(), 'title');
  update(s, { ...NO_INPUT, pause: true }, 1 / 60);
  startGame(s);
  update(s, { ...NO_INPUT, pause: true }, 1 / 60);
  assert.equal(s.phase, 'playing');
});

test('shouldRecord: only playing -> won/lost, never a quit from pause, a restart, a re-render or a debug run (D-22)', async () => {
  const { shouldRecord } = await import('../src/uimodel.js');
  const f = { debug: false };
  assert.equal(shouldRecord('playing', 'won', f), true);
  assert.equal(shouldRecord('playing', 'lost', f), true);
  assert.equal(shouldRecord('paused', 'title', f), false);   // quit from pause
  assert.equal(shouldRecord('paused', 'lost', f), false);
  assert.equal(shouldRecord('won', 'won', f), false);        // re-render of the end screen
  assert.equal(shouldRecord('won', 'playing', f), false);    // restart
  assert.equal(shouldRecord('lost', 'title', f), false);     // Menu from the end screen
  assert.equal(shouldRecord(null, 'title', f), false);
  assert.equal(shouldRecord('playing', 'won', { debug: true }), false);
});

test('gateInput: a modal sub-screen swallows every key, even the pause key', () => {
  const g = gateInput('paused', { ...all, pause: true }, true);
  assert.ok(Object.values(g).every((v) => v === false || v === 0));
  assert.equal(gateInput('paused', { ...all, pause: true }).pause, true);
});

test('startsDay: Play / Play again / R restart begin a day; resuming from pause does not (D-24)', async () => {
  const { startsDay } = await import('../src/uimodel.js');
  assert.equal(startsDay('title', 'playing'), true);
  assert.equal(startsDay('won', 'playing'), true);
  assert.equal(startsDay('lost', 'playing'), true);
  assert.equal(startsDay('paused', 'playing'), false);
  assert.equal(startsDay('playing', 'playing'), false);
  assert.equal(startsDay('playing', 'won'), false);
});

test('levelBannerText: new best, level best, unlock and debug note', async () => {
  const { levelBannerText, levelCard, levelEndButtons } = await import('../src/uimodel.js');
  assert.equal(levelBannerText(null), '');
  assert.equal(levelBannerText({ rank: 1, best: 5 }), ''); // an arcade result is not a level result
  assert.equal(levelBannerText({ level: true, best: 900, isBest: true, unlocked: 'Honey-Do List' }), 'New best!  ·  Level best: 900  ·  Honey-Do List unlocked!');
  assert.equal(levelBannerText({ level: true, best: 900, isBest: false }), 'Level best: 900');
  assert.equal(levelBannerText({ level: true, best: null, isBest: false, note: 'Debug run: not recorded' }), 'Debug run: not recorded');
  // cards
  const lvl = { name: 'Honey-Do List', briefing: 'b' };
  assert.deepEqual(levelCard(lvl, 1, undefined, false, 'Saturday Morning'),
    { title: '2. Honey-Do List', briefing: 'b', locked: true, won: false, bestText: '', lockText: 'Win Saturday Morning to unlock it.' });
  assert.equal(levelCard(lvl, 1, undefined, true).bestText, 'Not played yet');
  const won = levelCard(lvl, 1, { best: 700, won: true }, true);
  assert.deepEqual([won.won, won.locked, won.bestText], [true, false, 'Best: 700']);
  // end buttons: Next only when won and a next level is offered
  assert.deepEqual(levelEndButtons(true, { id: 'l2' }), ['next', 'retry', 'menu']);
  assert.deepEqual(levelEndButtons(true, null), ['retry', 'menu']);
  assert.deepEqual(levelEndButtons(false, { id: 'l2' }), ['retry', 'menu']);
});
