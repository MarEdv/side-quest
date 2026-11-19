import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANGS, STRINGS, t, setLang, getLang, backHref, clock } from '../src/i18n.js';
import { stringProblems, missingHtmlKeys } from '../src/kit/lang.js';
import { QUEST_TYPES, TRIP_NAMES, DIFFICULTIES } from '../src/config.js';

test('English and Swedish have the same keys and placeholders', () => {
  assert.deepEqual(LANGS, ['en', 'sv']);
  assert.deepEqual(stringProblems(STRINGS), []);
});

test('every data-i18n key in index.html exists', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.deepEqual(missingHtmlKeys(html, STRINGS), []);
});

test('every quest type has a title, offer, goal, done and failed text', () => {
  for (const type of QUEST_TYPES) for (const kind of ['title', 'offer', 'goal', 'done', 'failed']) {
    assert.ok(STRINGS.en[`q_${type}_${kind}`], `en q_${type}_${kind}`);
    assert.ok(STRINGS.sv[`q_${type}_${kind}`], `sv q_${type}_${kind}`);
  }
});

test('trips, difficulties, needs and items have names', () => {
  for (const k of TRIP_NAMES) assert.ok(STRINGS.en[`trip_${k}`]);
  for (const k of DIFFICULTIES) assert.ok(STRINGS.en[`diff_${k}`]);
  for (const k of ['ticket', 'coffee', 'snack', 'question', 'seat']) assert.ok(STRINGS.en[`need_${k}`]);
  for (const k of ['coffee', 'snack', 'water', 'kit', 'bag']) assert.ok(STRINGS.en[`item_${k}`]);
});

test('t fills placeholders and follows the current language', (tt) => {
  tt.after(() => setLang('en'));
  assert.equal(getLang(), 'en');
  assert.equal(t('q_rescue_goal', { n: 7, station: 'Alder' }), 'Seat all 7 rescued passengers before Alder');
  assert.equal(t('hudDelay', { n: 12 }, 'sv'), 'Försenad 12 s');
  setLang('sv');
  assert.equal(t('resume'), 'Fortsätt');
  assert.equal(t('nope'), 'nope');
});

test('the back link goes to the launcher and hands the language back', () => {
  assert.equal(backHref('en'), '../../?lang=en');
  assert.equal(backHref('sv'), '../../?lang=sv');
  assert.equal(backHref('xx'), '../../?lang=en');
  setLang('sv');
  assert.equal(backHref(), '../../?lang=sv');
  assert.equal(t('back'), 'Tillbaka till spelen');
  setLang('en');
  assert.equal(t('back'), 'Back to games');
});

test('clock formats m:ss', () => {
  assert.equal(clock(125), '2:05');
  assert.equal(clock(0), '0:00');
  assert.equal(clock(-3), '0:00');
  assert.equal(clock(59.2), '1:00');
});
