import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, STRINGS, TEXT_SV, setLang, getLang, pickLang, normalizeLang, t, tx, summaryText, dateLocale } from '../src/i18n.js';
import { LEVELS } from '../src/levels.js';
import { QUEST_TEMPLATES, DOOR, CURB } from '../src/quests.js';
import { END_MESSAGES } from '../src/game.js';
import { SETTING_GROUPS, inactiveReason, checkInput } from '../src/settings.js';
import { ENUMS } from '../src/config.js';
import { rankText, levelBannerText, levelCard } from '../src/uimodel.js';

// Runs fn in Swedish and always switches back, so other tests in this file see English.
const inSwedish = (fn) => { setLang('sv'); try { return fn(); } finally { setLang('en'); } };

test('English and Swedish have the same keys and placeholders', () => {
  assert.deepEqual(LANGS, ['en', 'sv']);
  assert.deepEqual(Object.keys(STRINGS.sv).sort(), Object.keys(STRINGS.en).sort());
  const vars = (s) => (s.match(/\{\w+\}/g) || []).sort();
  for (const k of Object.keys(STRINGS.en)) assert.deepEqual(vars(STRINGS.sv[k]), vars(STRINGS.en[k]), k);
});

test('every text in the data tables has a Swedish translation, and no translation is stale', () => {
  const texts = [
    ...LEVELS.flatMap((l) => [l.name, l.briefing]),
    ...QUEST_TEMPLATES.flatMap((q) => [q.title, q.say, q.pickup.label]), DOOR.label, CURB.label,
    ...Object.values(END_MESSAGES), 'Oh, you look busy. Carry on!',
    ...SETTING_GROUPS.flatMap((g) => [g.title, g.note, ...g.items.flatMap((i) => [i.label, i.help, ...Object.values(i.options || {})])]),
    ...ENUMS.wifeMode, ...ENUMS.difficulty, 'roam', 'patio',
  ];
  for (const s of texts) assert.ok(TEXT_SV[s], `no Swedish for "${s}"`);
  const known = new Set(texts);
  for (const k of Object.keys(TEXT_SV)) assert.ok(known.has(k), `stale translation "${k}"`);
});

test('the language starts as English and setLang only accepts supported languages', () => {
  assert.equal(getLang(), 'en');
  assert.equal(setLang('sv-SE'), 'sv');
  assert.equal(setLang('de'), 'en');
  assert.equal(t('resume'), 'Resume');
});

test('pickLang: ?lang= then saved choice then browser languages then English', () => {
  assert.equal(normalizeLang('SV_se'), 'sv');
  assert.equal(pickLang({ query: 'sv', saved: 'en' }), 'sv');
  assert.equal(pickLang({ query: 'xx', saved: 'sv', browser: ['en'] }), 'sv');
  assert.equal(pickLang({ browser: ['de', 'sv-FI'] }), 'sv');
  assert.equal(pickLang({ browser: ['fr'] }), 'en');
});

test('t / tx / summaryText follow the current language', () => {
  assert.equal(t('best', { n: 7 }), 'Best: 7');
  assert.equal(tx('Saturday Morning'), 'Saturday Morning');
  assert.equal(summaryText('vision·roam·normal'), 'vision·roam·normal');
  assert.equal(dateLocale(), undefined);
  inSwedish(() => {
    assert.equal(t('best', { n: 7 }), 'Bästa: 7');
    assert.equal(tx('Saturday Morning'), 'Lördagsmorgon');
    assert.equal(tx('no such text'), 'no such text');
    assert.equal(summaryText('random·hard'), 'slump·svår');
    assert.equal(dateLocale(), 'sv-SE');
  });
});

test('pure helpers speak the current language', () => {
  inSwedish(() => {
    assert.equal(rankText({ rank: 3, isBest: false }), 'Plats 3 på din lista');
    assert.equal(levelBannerText({ level: true, best: 120, isBest: true, unlocked: 'Honey-Do List' }), 'Nytt personbästa!  ·  Banans bästa: 120  ·  Fixarlistan är upplåst!');
    const c = levelCard(LEVELS[1], 1, undefined, false, LEVELS[0].name);
    assert.equal(c.title, '2. Fixarlistan');
    assert.equal(c.lockText, 'Vinn Lördagsmorgon för att låsa upp den.');
    assert.equal(inactiveReason('touchScheme', { touch: 'off' }), 'Bara när pekkontrollerna är på');
    assert.equal(checkInput('maxActiveQuests', '9').error, 'Ange ett heltal från 0 till 5.');
  });
  assert.equal(checkInput('maxActiveQuests', '9').error, 'Enter a whole number from 0 to 5.');
});
