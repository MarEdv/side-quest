import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANGS, STRINGS, normalizeLang, pickLang, getLang, setLang, t, tagLabel, localizeGame, gameHref } from '../src/i18n.js';
import { stringProblems, missingHtmlKeys } from '../kit/lang.js';
import { collect, ROOT } from '../tools/build-registry.mjs';

test('English and Swedish have the same keys, none empty', () => {
  assert.deepEqual(LANGS, ['en', 'sv']);
  assert.deepEqual(stringProblems(STRINGS), []);
});

test('every data-i18n key in index.html exists', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.ok(html.includes('data-i18n'));
  assert.deepEqual(missingHtmlKeys(html, STRINGS), []);
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

test('t uses the current language, falls back to English, then to the key', (ctx) => {
  ctx.after(() => setLang('en'));
  assert.equal(getLang(), 'en');
  assert.equal(t('play'), 'Play →');
  setLang('sv');
  assert.equal(t('play'), 'Spela →');
  assert.equal(t('no.such.key'), 'no.such.key');
  assert.equal(t('play', null, 'en'), 'Play →');
  assert.equal(t('play', null, 'xx'), 'Play →');
  assert.equal(tagLabel('touch'), 'pekskärm');
  assert.equal(tagLabel('touch', 'en'), 'touch');
  assert.equal(tagLabel('brand-new-tag'), 'brand-new-tag');
});

test('localizeGame uses entry.i18n.<lang> and falls back field by field', () => {
  const g = { title: 'Demo', description: 'A demo.', i18n: { sv: { description: 'En demo.' } } };
  assert.deepEqual(localizeGame(g, 'sv'), { title: 'Demo', description: 'En demo.' });
  assert.deepEqual(localizeGame(g, 'en'), { title: 'Demo', description: 'A demo.' });
  assert.deepEqual(localizeGame(g), { title: 'Demo', description: 'A demo.' }); // current language
  assert.deepEqual(localizeGame({ title: 'X', description: 'Y' }, 'sv'), { title: 'X', description: 'Y' });
});

test('card links pass the language on to the game', (ctx) => {
  ctx.after(() => setLang('en'));
  setLang('sv');
  assert.equal(gameHref({ path: 'games/demo/' }), 'games/demo/?lang=sv');
  assert.equal(gameHref({ path: 'games/demo/' }, 'sv'), 'games/demo/?lang=sv');
});

test('every listed game has a Swedish description', () => {
  for (const g of collect().games) assert.ok(g.i18n?.sv?.description, g.slug);
});
