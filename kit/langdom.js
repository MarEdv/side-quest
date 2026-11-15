// Browser: the page half of kit/lang.js (K-6, D-12). Picks the language when the page loads, remembers it, writes the
// texts into the page and runs the language switch.
//
// Markup: an element takes its text from the part's table through one of
//   data-i18n="key"        textContent
//   data-i18n-html="key"   innerHTML (texts from the part's own table only, never stored or fetched data)
//   data-i18n-aria="key"   aria-label
//   data-i18n-title="key"  title
// and a language switch is a group of buttons with data-lang="en", data-lang="sv": the current one gets
// aria-pressed="true".

const TARGETS = [
  ['i18n', (node, text) => { node.textContent = text; }],
  ['i18nHtml', (node, text) => { node.innerHTML = text; }],
  ['i18nAria', (node, text) => { node.setAttribute('aria-label', text); }],
  ['i18nTitle', (node, text) => { node.title = text; }],
];
const selector = (name) => `[data-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}]`;

// i18n: what createI18n() returned. storage: a kit/storage.js object, or null to remember nothing.
// The language is ?lang= (remembered, so a later visit without it keeps the language), else the saved choice, else the
// browser's languages, else the default. onChange(lang) runs after the player switches language.
// Returns { apply(root), set(lang), bindSwitch(element) }; call apply() once the page is ready.
export function setupLang(i18n, {
  storage = null, key = 'lang', onChange = () => {},
  doc = document, search = location.search,
  languages = navigator.languages?.length ? navigator.languages : [navigator.language],
} = {}) {
  const query = i18n.normalizeLang(new URLSearchParams(search).get('lang'));
  // A choice saved before the part stored JSON is a bare `sv`: text() reads that (a storage without text() is fine).
  const saved = storage ? storage.get(key) ?? storage.text?.(key) ?? null : null;
  if (query) storage?.set(key, query);
  i18n.setLang(i18n.pickLang({ query, saved, browser: languages }));

  // Writes the current language into root (the whole page by default): texts, <html lang>, the switch.
  function apply(root = doc) {
    const lang = i18n.getLang();
    doc.documentElement.lang = lang;
    for (const [name, write] of TARGETS) {
      for (const node of root.querySelectorAll(selector(name))) write(node, i18n.t(node.dataset[name]));
    }
    for (const button of root.querySelectorAll('[data-lang]')) button.setAttribute('aria-pressed', String(button.dataset.lang === lang));
  }

  // Switches language, remembers it and re-applies. Returns false (and does nothing) for the current or an unknown one.
  function set(lang) {
    const next = i18n.normalizeLang(lang);
    if (!next || next === i18n.getLang()) return false;
    i18n.setLang(next);
    storage?.set(key, next);
    apply();
    onChange(next);
    return true;
  }

  // A click on a [data-lang] button inside element switches to that language.
  function bindSwitch(element) {
    element.addEventListener('click', (e) => { set(e.target?.closest?.('[data-lang]')?.dataset.lang); });
  }

  return { apply, set, bindSwitch };
}
