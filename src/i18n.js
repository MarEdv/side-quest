// Launcher translations (L-9, D-7). Pure: no DOM, no storage; src/launcher.js gathers the facts and applies the strings.
// Games have their own translations (games never import from the launcher); the launcher hands its language to a game
// as ?lang=<code> on the card link.

export const LANGS = ['en', 'sv'];
export const DEFAULT_LANG = 'en';

export const STRINGS = {
  en: {
    lede: 'Small browser games about getting distracted. Pick one and play.',
    install: 'Install app',
    'ios.title': 'Add to your Home Screen',
    'ios.step1a': 'Tap the <strong>Share</strong> button',
    'ios.step1b': 'in the toolbar.',
    'ios.step2': 'Choose <strong>Add to Home Screen</strong>.',
    'ios.step3': 'Tap <strong>Add</strong>. Side Quests now opens full-screen from your home screen.',
    'ios.shareIcon': 'Share icon',
    close: 'Close',
    loading: 'Loading games…',
    empty: 'No games yet.',
    error: 'Could not load the game list. Try reloading the page.',
    play: 'Play →',
    source: 'Source on GitHub',
    language: 'Language',
    'tag.keyboard': 'keyboard',
    'tag.touch': 'touch',
    'tag.installable': 'installable',
  },
  sv: {
    lede: 'Små webbläsarspel om att bli distraherad. Välj ett och spela.',
    install: 'Installera appen',
    'ios.title': 'Lägg till på hemskärmen',
    'ios.step1a': 'Tryck på knappen <strong>Dela</strong>',
    'ios.step1b': 'i verktygsfältet.',
    'ios.step2': 'Välj <strong>Lägg till på hemskärmen</strong>.',
    'ios.step3': 'Tryck på <strong>Lägg till</strong>. Side Quests öppnas nu i helskärm från hemskärmen.',
    'ios.shareIcon': 'Dela-ikon',
    close: 'Stäng',
    loading: 'Laddar spel…',
    empty: 'Inga spel än.',
    error: 'Kunde inte ladda spellistan. Försök att ladda om sidan.',
    play: 'Spela →',
    source: 'Källkod på GitHub',
    language: 'Språk',
    'tag.keyboard': 'tangentbord',
    'tag.touch': 'pekskärm',
    'tag.installable': 'installerbart',
  },
};

// 'sv-SE' → 'sv'; unknown or empty → null.
export function normalizeLang(code) {
  const base = String(code || '').trim().toLowerCase().split(/[-_]/)[0];
  return LANGS.includes(base) ? base : null;
}

// ?lang= wins, then the player's saved choice, then the first supported browser language, then English.
export function pickLang({ query = null, saved = null, browser = [] } = {}) {
  for (const c of [query, saved, ...browser]) {
    const lang = normalizeLang(c);
    if (lang) return lang;
  }
  return DEFAULT_LANG;
}

// Missing key in a language falls back to English, then to the key itself.
export function t(lang, key) {
  return STRINGS[lang]?.[key] ?? STRINGS[DEFAULT_LANG][key] ?? key;
}

// A tag without a translation is shown as written in game.json.
export const tagLabel = (lang, tag) => STRINGS[lang]?.[`tag.${tag}`] ?? tag;

// A games.json entry's title and description in `lang` (entry.i18n.<lang>, falling back to the English fields).
export function localizeGame(game, lang) {
  const tr = game.i18n?.[lang] ?? {};
  return { title: tr.title || game.title, description: tr.description || game.description };
}

// Card link: the game opens in the launcher's language.
export const gameHref = (game, lang) => `${game.path}?lang=${lang}`;
