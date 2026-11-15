import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANGS, STRINGS, NAMES, pickLang, normalizeLang, t, name } from '../src/i18n.js';
import { STATIONS, TASKS, POO_TASKS } from '../src/world.js';

test('English and Swedish have the same keys and placeholders', () => {
  assert.deepEqual(LANGS, ['en', 'sv']);
  assert.deepEqual(Object.keys(STRINGS.sv).sort(), Object.keys(STRINGS.en).sort());
  const vars = (s) => (s.match(/\{\w+\}/g) || []).sort();
  for (const k of Object.keys(STRINGS.en)) assert.deepEqual(vars(STRINGS.sv[k]), vars(STRINGS.en[k]), k);
});

test('every station, task and poo task has a Swedish name', () => {
  const labels = [...Object.values(STATIONS), ...TASKS, ...POO_TASKS].map((x) => x.label);
  for (const l of labels) assert.ok(NAMES.sv[l], l);
  assert.equal(Object.keys(NAMES.sv).length, new Set(labels).size, 'no stale names');
});

test('every data-i18n key in index.html exists', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-html|-aria)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length >= 10);
  for (const k of keys) assert.ok(k in STRINGS.en, k);
});

test('pickLang: ?lang= then saved choice then browser languages then English', () => {
  assert.equal(normalizeLang('sv-SE'), 'sv');
  assert.equal(normalizeLang('de'), null);
  assert.equal(pickLang({ query: 'sv', saved: 'en' }), 'sv');
  assert.equal(pickLang({ query: 'xx', saved: 'sv', browser: ['en'] }), 'sv');
  assert.equal(pickLang({ browser: ['de-DE', 'sv'] }), 'sv');
  assert.equal(pickLang({ browser: ['fr'] }), 'en');
});

test('t fills placeholders and falls back to English, then the key; name falls back to English', () => {
  assert.equal(t('sv', 'best', { n: 1200 }), 'Bästa poäng: 1200');
  assert.equal(t('en', 'wonText', { stress: 12, bonus: 880 }), '17:00. You clocked out with 12% stress. Calm bonus: +880.');
  assert.equal(t('xx', 'resume'), 'Resume');
  assert.equal(t('sv', 'nope'), 'nope');
  assert.equal(name('sv', 'Get coffee'), 'Hämta kaffe');
  assert.equal(name('en', 'Get coffee'), 'Get coffee');
});
