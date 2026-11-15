import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANGS, STRINGS, NAMES, pickLang, normalizeLang, getLang, setLang, t, name } from '../src/i18n.js';
import { stringProblems, missingHtmlKeys } from '../src/kit/lang.js';
import { STATIONS, TASKS, POO_TASKS } from '../src/world.js';

test('English and Swedish have the same keys and placeholders, none empty', () => {
  assert.deepEqual(LANGS, ['en', 'sv']);
  assert.deepEqual(stringProblems(STRINGS), []);
});

test('every station, task and poo task has a Swedish name', () => {
  const labels = [...Object.values(STATIONS), ...TASKS, ...POO_TASKS].map((x) => x.label);
  for (const l of labels) assert.ok(NAMES.sv[l], l);
  assert.equal(Object.keys(NAMES.sv).length, new Set(labels).size, 'no stale names');
});

test('every data-i18n key in index.html exists', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('data-i18n'));
  assert.deepEqual(missingHtmlKeys(html, STRINGS), []);
});

test('pickLang: ?lang= then saved choice then browser languages then English', () => {
  assert.equal(normalizeLang('sv-SE'), 'sv');
  assert.equal(normalizeLang('de'), null);
  assert.equal(pickLang({ query: 'sv', saved: 'en' }), 'sv');
  assert.equal(pickLang({ query: 'xx', saved: 'sv', browser: ['en'] }), 'sv');
  assert.equal(pickLang({ browser: ['de-DE', 'sv'] }), 'sv');
  assert.equal(pickLang({ browser: ['fr'] }), 'en');
});

test('t fills placeholders in the current language and falls back to English, then the key; name falls back to English', (ctx) => {
  ctx.after(() => setLang('en'));
  assert.equal(getLang(), 'en');
  assert.equal(t('wonText', { stress: 12, bonus: 880 }), '17:00. You clocked out with 12% stress. Calm bonus: +880.');
  assert.equal(name('Get coffee'), 'Get coffee');
  setLang('sv');
  assert.equal(t('best', { n: 1200 }), 'Bästa poäng: 1200');
  assert.equal(t('nope'), 'nope');
  assert.equal(name('Get coffee'), 'Hämta kaffe');
  assert.equal(name('Not a task'), 'Not a task');
  assert.equal(t('resume', null, 'xx'), 'Resume');
  assert.equal(name('Get coffee', 'en'), 'Get coffee');
});
