import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANGS, STRINGS, NAMES, t, num, pickLang, normalizeLang, getLang, setLang, gemName, hatchetName, hatchetShort, hatchetTitle, rockNames } from '../src/i18n.js';
import { stringProblems, missingHtmlKeys } from '../src/kit/lang.js';
import { GEMS, DREAM } from '../src/economy.js';
import { HATCHETS } from '../src/mining.js';
import { createGame, update } from '../src/game.js';
import { T } from '../src/tiles.js';

test('English and Swedish have the same keys and placeholders', () => {
  assert.deepEqual(LANGS, ['en', 'sv']);
  assert.deepEqual(stringProblems(STRINGS), []);
});

test('every gem, hatchet and rock has a name in both languages', () => {
  for (const lang of LANGS) {
    for (const g of [...GEMS, DREAM]) assert.ok(NAMES[lang].gems[g.id], `${lang} ${g.id}`);
    for (const h of HATCHETS) assert.ok(NAMES[lang].short[h.id] && NAMES[lang].full[h.id], `${lang} ${h.id}`);
    assert.equal(NAMES[lang].rocks.length, Math.max(...HATCHETS.map((h) => h.power)));
  }
  assert.equal(gemName('ruby', 'sv'), 'Rubin');
  assert.equal(gemName('dream', 'en'), DREAM.name);
  assert.equal(hatchetName('stone', 'en'), 'Stone hatchet');
  assert.equal(hatchetName('stone', 'sv'), 'stenyxa');
  assert.equal(hatchetTitle('gem', 'sv'), 'Ädelstensyxa');
  assert.equal(hatchetShort('steel', 'sv'), 'Stål');
  assert.equal(rockNames(3, 'sv'), 'jord, sten, granit');
  // the English names match the economy and mining tables they used to come from (English is the default)
  for (const g of GEMS) assert.equal(gemName(g.id), g.name);
  for (const h of HATCHETS) assert.equal(hatchetShort(h.id), h.name);
});

test('lookups follow the current language', (tt) => {
  tt.after(() => setLang('en'));
  setLang('sv');
  assert.equal(gemName('ruby'), 'Rubin');
  assert.equal(hatchetTitle('gem'), 'Ädelstensyxa');
  assert.equal(rockNames(2), 'jord, sten');
  assert.equal(gemName('ruby', 'en'), 'Ruby');
});

test('every data-i18n key in index.html exists', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-html|-aria|-title)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length >= 30);
  assert.deepEqual(missingHtmlKeys(html, STRINGS), []);
});

test('language order: ?lang=, saved, browser, English', () => {
  assert.equal(normalizeLang('sv-FI'), 'sv');
  assert.equal(normalizeLang('nb'), null);
  assert.equal(pickLang({ query: 'sv', saved: 'en' }), 'sv');
  assert.equal(pickLang({ query: null, saved: 'sv', browser: ['en-GB'] }), 'sv');
  assert.equal(pickLang({ browser: ['de', 'sv-SE'] }), 'sv');
  assert.equal(pickLang({ browser: ['de'] }), 'en');
});

test('t fills placeholders; numbers use the language\'s grouping', (tt) => {
  tt.after(() => setLang('en'));
  assert.equal(getLang(), 'en');
  assert.equal(t('resume'), 'Resume');
  assert.equal(t('nope'), 'nope');
  assert.equal(num(32000), '32,000');
  assert.equal(t('chestCoins', { n: 40 }, 'sv'), 'Kista: 40 mynt');
  assert.equal(t('resume', undefined, 'xx'), 'Resume');
  assert.equal(setLang('xx'), 'en');
  setLang('sv');
  assert.equal(t('chestCoins', { n: 40 }), 'Kista: 40 mynt');
  assert.equal(num(32000).replace(/\s/g, ' '), '32 000');
  assert.equal(num(32000, 'en'), '32,000');
});

test('game hints follow the current language (English by default)', (tt) => {
  tt.after(() => setLang('en'));
  const hard = (lang) => {
    if (lang) setLang(lang);
    const s = createGame({ seed: 4, size: 128, flags: { fog: true } });
    assert.equal('lang' in s, false); // the language is not game state, so it is never saved
    const { x, y } = s.player, i = y * s.size + x + 1;
    s.world.tiles[i] = T.GRANITE; s.world.ring[i] = 2;
    for (let k = 0; k < 30; k++) update(s, { dx: 1, dy: 0 }, 1 / 60);
    return s.hint;
  };
  assert.equal(hard(), 'Too hard for your Wood hatchet');
  assert.equal(hard('sv'), 'För hårt för din träyxa');
});
