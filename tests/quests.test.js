import { test } from 'node:test';
import assert from 'node:assert/strict';
import { giveQuest, QUEST_TEMPLATES, HARMONY } from '../src/quests.js';
import { update } from '../src/game.js';
import { playing, NO_INPUT } from './helpers.js';

const quiet = { wifeMode: 'random', questInterval: 300 };
const act = { ...NO_INPUT, action: true };

test('giveQuest respects maxActiveQuests and avoids duplicates', () => {
  const s = playing({ ...quiet, maxActiveQuests: 2 });
  assert.ok(giveQuest(s));
  assert.ok(giveQuest(s));
  assert.equal(giveQuest(s), null);
  assert.notEqual(s.quests[0].templateId, s.quests[1].templateId);
  assert.equal(s.events.filter((e) => e.type === 'questGiven').length, 2);
});

test('pickup then deliver completes quest and raises harmony', () => {
  const s = playing(quiet);
  const q = giveQuest(s);
  s.player.x = q.pickup.x; s.player.y = q.pickup.y;
  update(s, act, 1 / 60);
  assert.equal(s.carry, q.id);
  assert.equal(q.stage, 'deliver');
  assert.ok(s.events.some((e) => e.type === 'pickup'));
  s.player.x = q.drop.x; s.player.y = q.drop.y;
  const h = s.harmony;
  update(s, act, 1 / 60);
  assert.equal(s.carry, null);
  assert.equal(s.quests.length, 0);
  assert.equal(s.stats.questsCompleted, 1);
  assert.ok(Math.abs(s.harmony - (h + HARMONY.onComplete)) < 0.1);
  assert.ok(s.events.some((e) => e.type === 'questCompleted'));
});

test('only one item carried at a time', () => {
  const s = playing(quiet);
  const a = giveQuest(s), b = giveQuest(s);
  s.player.x = a.pickup.x; s.player.y = a.pickup.y;
  update(s, act, 1 / 60);
  s.player.x = b.pickup.x; s.player.y = b.pickup.y;
  update(s, act, 1 / 60);
  assert.equal(s.carry, a.id);
  assert.equal(b.stage, 'fetch');
});

test('expired quest lowers harmony, drops carried item, counts as failed', () => {
  const s = playing(quiet);
  const q = giveQuest(s);
  s.player.x = q.pickup.x; s.player.y = q.pickup.y;
  update(s, act, 1 / 60);
  s.player.x = 480; s.player.y = 300;
  q.timeLeft = 0.01;
  const h = s.harmony;
  update(s, NO_INPUT, 1 / 60);
  assert.equal(s.quests.length, 0);
  assert.equal(s.carry, null);
  assert.equal(s.stats.questsFailed, 1);
  assert.ok(Math.abs(s.harmony - (h + HARMONY.onFail)) < 0.1);
  assert.ok(s.events.some((e) => e.type === 'questFailed'));
});

test('harmony decays slowly (1 per in-game hour) while a quest is active', () => {
  const s = playing(quiet);
  giveQuest(s);
  const hourSecs = s.dayLength / 9;
  const steps = Math.round(hourSecs * 60);
  for (let i = 0; i < steps; i++) update(s, NO_INPUT, 1 / 60);
  assert.ok(Math.abs(s.harmony - 59) < 0.05, `harmony ${s.harmony}`);
});

test('difficulty scales deadlines; all templates well-formed', () => {
  const easy = playing({ ...quiet, difficulty: 'easy' }), hard = playing({ ...quiet, difficulty: 'hard' });
  assert.ok(giveQuest(easy).timeTotal > giveQuest(hard).timeTotal);
  for (const t of QUEST_TEMPLATES) assert.ok(t.pickup && t.drop && t.time > 0);
});
