import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createI18n, interpolate, stringProblems, htmlKeys, missingHtmlKeys } from '../kit/lang.js';
import { setupLang } from '../kit/langdom.js';
import { createStorage } from '../kit/storage.js';

const STRINGS = {
  en: { play: 'Play', best: 'Best: {n}', only: 'English only', rich: 'Tap <b>Share</b>', close: 'Close', tip: 'Coins' },
  sv: { play: 'Spela', best: 'Bästa: {n}', rich: 'Tryck på <b>Dela</b>', close: 'Stäng', tip: 'Mynt' },
};

// ---------------------------------------------------------------- kit/lang.js

test('interpolate fills {placeholders} and leaves unknown ones as written', () => {
  assert.equal(interpolate('Best: {n}', { n: 5 }), 'Best: 5');
  assert.equal(interpolate('{a} and {b}', { a: 0 }), '0 and {b}');
  assert.equal(interpolate('no vars {n}'), 'no vars {n}');
});

test('the first language is the default and the starting language', () => {
  const i = createI18n(STRINGS);
  assert.deepEqual(i.LANGS, ['en', 'sv']);
  assert.equal(i.DEFAULT_LANG, 'en');
  assert.equal(i.getLang(), 'en');
});

test('normalizeLang keeps the base language when it is supported', () => {
  const { normalizeLang } = createI18n(STRINGS);
  assert.equal(normalizeLang('sv-SE'), 'sv');
  assert.equal(normalizeLang(' EN_us '), 'en');
  for (const junk of ['de', '', null, undefined, 42, {}, 'svenska']) assert.equal(normalizeLang(junk), null);
});

test('pickLang: ?lang= then saved choice then browser languages then the default', () => {
  const { pickLang } = createI18n(STRINGS);
  assert.equal(pickLang({ query: 'sv', saved: 'en', browser: ['en'] }), 'sv');
  assert.equal(pickLang({ query: 'xx', saved: 'sv', browser: ['en'] }), 'sv');
  assert.equal(pickLang({ saved: null, browser: ['de-DE', 'sv-SE', 'en'] }), 'sv');
  assert.equal(pickLang({ browser: ['de', 'fr'] }), 'en');
  assert.equal(pickLang({ browser: null }), 'en');
  assert.equal(pickLang(), 'en');
});

test('setLang only accepts supported languages, and t follows the current one', () => {
  const i = createI18n(STRINGS);
  assert.equal(i.setLang('sv-SE'), 'sv');
  assert.equal(i.t('play'), 'Spela');
  assert.equal(i.t('best', { n: 7 }), 'Bästa: 7');
  assert.equal(i.setLang('klingon'), 'en');
  assert.equal(i.t('play'), 'Play');
});

test('t falls back to the default language, then to the key; a language can be asked for by name', () => {
  const i = createI18n(STRINGS);
  i.setLang('sv');
  assert.equal(i.t('only'), 'English only');
  assert.equal(i.t('nope'), 'nope');
  assert.equal(i.t('play', undefined, 'en'), 'Play');
  assert.equal(i.t('best', { n: 1 }, 'xx'), 'Best: 1');
});

test('two i18n objects do not share a current language', () => {
  const a = createI18n(STRINGS), b = createI18n(STRINGS);
  a.setLang('sv');
  assert.equal(b.getLang(), 'en');
});

test('stringProblems: missing, extra and empty texts, and placeholders that differ', () => {
  assert.deepEqual(stringProblems({ en: { a: 'A {n}', b: 'B' }, sv: { a: 'A {n}', b: 'B' } }), []);
  assert.deepEqual(stringProblems(STRINGS), ['sv.only is missing']);
  assert.deepEqual(
    stringProblems({ en: { a: 'A {n}', b: 'B', c: ' ' }, sv: { a: 'A {m}', b: '', c: 'C', d: 'D' } }),
    ['en.c is empty', 'sv.a has other placeholders than en.a', 'sv.b is empty', 'sv.d has no en text'],
  );
});

test('htmlKeys finds every data-i18n attribute once; missingHtmlKeys lists the ones without a text', () => {
  const html = `<p data-i18n="play">Play</p><li data-i18n-html='rich'></li><svg data-i18n-aria="close"></svg>
    <span title="Coins" data-i18n-title="tip"></span><b data-i18n="play"></b><i data-i18n="gone"></i><u data-i18nx="no"></u>`;
  assert.deepEqual(htmlKeys(html), ['play', 'rich', 'close', 'tip', 'gone']);
  assert.deepEqual(missingHtmlKeys(html, STRINGS), ['gone']);
});

// ---------------------------------------------------------------- kit/langdom.js (with a stand-in for the page)

const camel = (name) => name.replace(/-(\w)/g, (m, c) => c.toUpperCase());
function fakeNode(dataset = {}) {
  const node = { dataset, attrs: {}, textContent: '', innerHTML: '', title: '', listeners: {} };
  node.setAttribute = (k, v) => { node.attrs[k] = v; };
  node.addEventListener = (type, f) => { node.listeners[type] = f; };
  node.closest = (sel) => (sel === '[data-lang]' && 'lang' in dataset ? node : null);
  return node;
}
function fakePage() {
  const nodes = {
    play: fakeNode({ i18n: 'play' }), rich: fakeNode({ i18nHtml: 'rich' }), close: fakeNode({ i18nAria: 'close' }),
    tip: fakeNode({ i18nTitle: 'tip' }), en: fakeNode({ lang: 'en' }), sv: fakeNode({ lang: 'sv' }), plain: fakeNode(),
  };
  const querySelectorAll = (sel) => { const key = camel(/^\[data-([\w-]+)\]$/.exec(sel)[1]); return Object.values(nodes).filter((n) => key in n.dataset); };
  return { nodes, doc: { documentElement: {}, querySelectorAll } };
}
const memBackend = () => { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) }; };
function setup({ search = '', languages = ['en-GB'], stored = {}, onChange } = {}) {
  const backend = memBackend();
  for (const [k, v] of Object.entries(stored)) backend.m.set(k, v);
  const i18n = createI18n(STRINGS), page = fakePage();
  const lang = setupLang(i18n, { storage: createStorage(backend, 'part.'), doc: page.doc, search, languages, onChange });
  return { i18n, lang, backend, ...page };
}

test('setupLang: ?lang= wins and is remembered', () => {
  const { i18n, backend } = setup({ search: '?debug=1&lang=sv', stored: { 'part.lang': '"en"' } });
  assert.equal(i18n.getLang(), 'sv');
  assert.equal(backend.m.get('part.lang'), '"sv"');
});

test('setupLang: an unsupported ?lang= is ignored and not remembered', () => {
  const { i18n, backend } = setup({ search: '?lang=de', languages: ['sv-SE'] });
  assert.equal(i18n.getLang(), 'sv');
  assert.ok(!backend.m.has('part.lang'));
});

test('setupLang: the saved choice beats the browser language, whether stored as JSON or as a bare word', () => {
  assert.equal(setup({ stored: { 'part.lang': '"sv"' } }).i18n.getLang(), 'sv');
  assert.equal(setup({ stored: { 'part.lang': 'sv' } }).i18n.getLang(), 'sv');
  assert.equal(setup({ stored: { 'part.lang': '{"junk":1}' }, languages: ['sv'] }).i18n.getLang(), 'sv');
  assert.equal(setup({ languages: ['fr'] }).i18n.getLang(), 'en');
});

test('setupLang accepts a storage that only has get and set', () => {
  const values = { lang: 'sv' };
  const storage = { get: (k) => values[k] ?? null, set: (k, v) => { values[k] = v; } };
  const i18n = createI18n(STRINGS), page = fakePage();
  const lang = setupLang(i18n, { storage, doc: page.doc, search: '', languages: ['en'] });
  assert.equal(i18n.getLang(), 'sv');
  lang.set('en');
  assert.equal(values.lang, 'en');
  const empty = { get: () => null, set() {} };
  assert.equal(setupLang(createI18n(STRINGS), { storage: empty, doc: page.doc, search: '', languages: ['sv'] }) && true, true);
});

test('setupLang works without storage', () => {
  const i18n = createI18n(STRINGS), page = fakePage();
  const lang = setupLang(i18n, { doc: page.doc, search: '?lang=sv', languages: [] });
  assert.equal(i18n.getLang(), 'sv');
  assert.equal(lang.set('en'), true);
});

test('apply writes text, markup, aria-label and title, sets <html lang> and marks the switch', () => {
  const { lang, nodes, doc } = setup({ search: '?lang=sv' });
  lang.apply();
  assert.equal(doc.documentElement.lang, 'sv');
  assert.equal(nodes.play.textContent, 'Spela');
  assert.equal(nodes.play.innerHTML, '', 'data-i18n never writes markup');
  assert.equal(nodes.rich.innerHTML, 'Tryck på <b>Dela</b>');
  assert.equal(nodes.close.attrs['aria-label'], 'Stäng');
  assert.equal(nodes.tip.title, 'Mynt');
  assert.equal(nodes.sv.attrs['aria-pressed'], 'true');
  assert.equal(nodes.en.attrs['aria-pressed'], 'false');
  assert.equal(nodes.plain.textContent, '');
});

test('set switches, remembers, re-applies and tells the part; the current or an unknown language does nothing', () => {
  const seen = [];
  const { i18n, lang, nodes, backend } = setup({ onChange: (l) => seen.push(l) });
  lang.apply();
  assert.equal(lang.set('en'), false);
  assert.equal(lang.set('de'), false);
  assert.deepEqual(seen, []);
  assert.ok(!backend.m.has('part.lang'), 'nothing is saved until the player chooses');
  assert.equal(lang.set('sv'), true);
  assert.equal(i18n.getLang(), 'sv');
  assert.equal(backend.m.get('part.lang'), '"sv"');
  assert.equal(nodes.play.textContent, 'Spela');
  assert.equal(nodes.sv.attrs['aria-pressed'], 'true');
  assert.deepEqual(seen, ['sv']);
});

test('bindSwitch: a click on a language button switches; a click elsewhere in the group does not', () => {
  const { i18n, lang, nodes } = setup();
  const group = fakeNode();
  lang.bindSwitch(group);
  group.listeners.click({ target: nodes.plain });
  assert.equal(i18n.getLang(), 'en');
  group.listeners.click({ target: nodes.sv });
  assert.equal(i18n.getLang(), 'sv');
  group.listeners.click({ target: null });
  assert.equal(i18n.getLang(), 'sv');
});
