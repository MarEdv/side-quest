import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANGS, STRINGS, NAMES, t, num, pickLang, normalizeLang, gemName, hatchetName, hatchetShort, hatchetTitle, rockNames } from '../src/i18n.js';
import { GEMS, DREAM } from '../src/economy.js';
import { HATCHETS } from '../src/mining.js';
import { createGame, update } from '../src/game.js';
import { T } from '../src/tiles.js';

test('English and Swedish have the same keys and placeholders', () => {
  assert.deepEqual(LANGS, ['en', 'sv']);
  assert.deepEqual(Object.keys(STRINGS.sv).sort(), Object.keys(STRINGS.en).sort());
  const vars = (s) => (s.match(/\{\w+\}/g) || []).sort();
  for (const k of Object.keys(STRINGS.en)) assert.deepEqual(vars(STRINGS.sv[k]), vars(STRINGS.en[k]), k);
});

test('every gem, hatchet and rock has a name in both languages', () => {
  for (const lang of LANGS) {
    for (const g of [...GEMS, DREAM]) assert.ok(NAMES[lang].gems[g.id], `${lang} ${g.id}`);
    for (const h of HATCHETS) assert.ok(NAMES[lang].short[h.id] && NAMES[lang].full[h.id], `${lang} ${h.id}`);
    assert.equal(NAMES[lang].rocks.length, Math.max(...HATCHETS.map((h) => h.power)));
  }
  assert.equal(gemName('sv', 'ruby'), 'Rubin');
  assert.equal(gemName('en', 'dream'), DREAM.name);
  assert.equal(hatchetName('en', 'stone'), 'Stone hatchet');
  assert.equal(hatchetName('sv', 'stone'), 'stenyxa');
  assert.equal(hatchetTitle('sv', 'gem'), 'Ädelstensyxa');
  assert.equal(hatchetShort('sv', 'steel'), 'Stål');
  assert.equal(rockNames('sv', 3), 'jord, sten, granit');
  // the English names match the economy and mining tables they used to come from
  for (const g of GEMS) assert.equal(gemName('en', g.id), g.name);
  for (const h of HATCHETS) assert.equal(hatchetShort('en', h.id), h.name);
});

test('every data-i18n key in index.html exists', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-html|-aria|-title)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length >= 30);
  for (const k of keys) assert.ok(k in STRINGS.en, k);
});

test('language order: ?lang=, saved, browser, English', () => {
  assert.equal(normalizeLang('sv-FI'), 'sv');
  assert.equal(normalizeLang('nb'), null);
  assert.equal(pickLang({ query: 'sv', saved: 'en' }), 'sv');
  assert.equal(pickLang({ query: null, saved: 'sv', browser: ['en-GB'] }), 'sv');
  assert.equal(pickLang({ browser: ['de', 'sv-SE'] }), 'sv');
  assert.equal(pickLang({ browser: ['de'] }), 'en');
});

test('t fills placeholders; numbers use the language\'s grouping', () => {
  assert.equal(t('sv', 'chestCoins', { n: 40 }), 'Kista: 40 mynt');
  assert.equal(t('xx', 'resume'), 'Resume');
  assert.equal(t('en', 'nope'), 'nope');
  assert.equal(num('en', 32000), '32,000');
  assert.equal(num('sv', 32000).replace(/\s/g, ' '), '32 000');
});

test('game hints follow state.lang (English by default)', () => {
  const hard = (lang) => {
    const s = createGame({ seed: 4, size: 128, flags: { fog: true } });
    if (lang) s.lang = lang;
    const { x, y } = s.player, i = y * s.size + x + 1;
    s.world.tiles[i] = T.GRANITE; s.world.ring[i] = 2;
    for (let k = 0; k < 30; k++) update(s, { dx: 1, dy: 0 }, 1 / 60);
    return s.hint;
  };
  assert.equal(hard(), 'Too hard for your Wood hatchet');
  assert.equal(hard('sv'), 'För hårt för din träyxa');
});
