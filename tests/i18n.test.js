import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANGS, STRINGS, normalizeLang, pickLang, t, tagLabel, localizeGame, gameHref } from '../src/i18n.js';
import { collect, ROOT } from '../tools/build-registry.mjs';

test('English and Swedish have the same keys, none empty', () => {
  assert.deepEqual(LANGS, ['en', 'sv']);
  assert.deepEqual(Object.keys(STRINGS.sv).sort(), Object.keys(STRINGS.en).sort());
  for (const lang of LANGS) for (const [k, v] of Object.entries(STRINGS[lang])) assert.ok(v.trim(), `${lang}.${k}`);
});

test('every data-i18n key in index.html exists', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-html|-aria)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length >= 10);
  for (const k of keys) assert.ok(k in STRINGS.en, k);
});

test('normalizeLang keeps the base language when it is supported', () => {
  assert.equal(normalizeLang('sv-SE'), 'sv');
  assert.equal(normalizeLang('EN_us'), 'en');
  assert.equal(normalizeLang('de'), null);
  assert.equal(normalizeLang(''), null);
  assert.equal(normalizeLang(null), null);
});

test('pickLang: ?lang= then saved choice then browser languages then English', () => {
  assert.equal(pickLang({ query: 'sv', saved: 'en', browser: ['en'] }), 'sv');
  assert.equal(pickLang({ query: 'xx', saved: 'sv', browser: ['en'] }), 'sv');
  assert.equal(pickLang({ browser: ['de-DE', 'sv-FI', 'en'] }), 'sv');
  assert.equal(pickLang({ browser: ['de', 'fr'] }), 'en');
  assert.equal(pickLang(), 'en');
});

test('t falls back to English, then to the key', () => {
  assert.equal(t('sv', 'play'), 'Spela →');
  assert.equal(t('xx', 'play'), 'Play →');
  assert.equal(t('sv', 'no.such.key'), 'no.such.key');
  assert.equal(tagLabel('sv', 'touch'), 'pekskärm');
  assert.equal(tagLabel('sv', 'brand-new-tag'), 'brand-new-tag');
});

test('localizeGame uses entry.i18n.<lang> and falls back field by field', () => {
  const g = { title: 'Demo', description: 'A demo.', i18n: { sv: { description: 'En demo.' } } };
  assert.deepEqual(localizeGame(g, 'sv'), { title: 'Demo', description: 'En demo.' });
  assert.deepEqual(localizeGame(g, 'en'), { title: 'Demo', description: 'A demo.' });
  assert.deepEqual(localizeGame({ title: 'X', description: 'Y' }, 'sv'), { title: 'X', description: 'Y' });
});

test('card links pass the language on to the game', () => {
  assert.equal(gameHref({ path: 'games/demo/' }, 'sv'), 'games/demo/?lang=sv');
});

test('every listed game has a Swedish description', () => {
  for (const g of collect().games) assert.ok(g.i18n?.sv?.description, g.slug);
});
