import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { LANGS, STRINGS, t, setLang, getLang, backHref, clock } from '../src/i18n.js';
import { stringProblems, missingHtmlKeys } from '../src/kit/lang.js';
import { LENGTHS, ROADS, DIFFICULTIES, STAGE_NAMES } from '../src/config.js';

test('English and Swedish have the same keys and placeholders', () => {
  assert.deepEqual(LANGS, ['en', 'sv']);
  assert.deepEqual(stringProblems(STRINGS), []);
});

// index.html is written by the browser layer; until it exists there is nothing to check.
test('every data-i18n key in index.html exists', (tt) => {
  const file = new URL('../index.html', import.meta.url);
  if (!existsSync(file)) return tt.skip('no index.html yet');
  assert.deepEqual(missingHtmlKeys(readFileSync(file, 'utf8'), STRINGS), []);
});

test('lengths, roads, difficulties and stages have names and toasts', () => {
  for (const k of LENGTHS) assert.ok(STRINGS.en[`length_${k}`] && STRINGS.sv[`length_${k}`], k);
  for (const k of ROADS) assert.ok(STRINGS.en[`road_${k}`] && STRINGS.sv[`road_${k}`], k);
  for (const k of DIFFICULTIES) assert.ok(STRINGS.en[`diff_${k}`] && STRINGS.sv[`diff_${k}`], k);
  for (const k of STAGE_NAMES) assert.ok(STRINGS.en[`stage_${k}`] && STRINGS.en[`toastStage_${k}`] && STRINGS.sv[`toastStage_${k}`], k);
  for (let n = 1; n <= 4; n++) assert.ok(STRINGS.en[`howto${n}`] && STRINGS.sv[`howto${n}`], `howto${n}`);
});

test('t fills placeholders and follows the current language', (tt) => {
  tt.after(() => setLang('en'));
  assert.equal(getLang(), 'en');
  assert.equal(t('toastNearMissStreak', { points: 50, mult: 2 }), 'Near miss! +50 (x2)');
  assert.equal(t('hudStage', { n: 2 }, 'sv'), 'Etapp 2 av 3');
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
