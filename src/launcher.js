// Launcher: reads games.json and renders one card per game. Browser glue only; the rules live in registry.js.
import { sortGames } from './registry.js';
import { installKind, detectIOS, detectStandalone } from './installmodel.js';
import { pickLang, normalizeLang, t, tagLabel, localizeGame, gameHref } from './i18n.js';

const list = document.getElementById('games');
const status = document.getElementById('status');
const LANG_KEY = 'launcher.lang';
let games = null;
let statusKey = 'loading';

// localStorage can throw (private mode, blocked storage): the language then just isn't remembered.
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch (_) { /* not remembered */ } },
};
let lang = pickLang({
  query: new URLSearchParams(location.search).get('lang'),
  saved: storage.get(LANG_KEY),
  browser: navigator.languages?.length ? navigator.languages : [navigator.language],
});

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function card(game) {
  const art = el('div', { className: 'art' });
  if (game.thumbnail) art.append(el('img', { src: game.thumbnail, alt: '', loading: 'lazy' }));
  else art.append(el('span', { ariaHidden: 'true', textContent: game.icon || '🎮' }));
  const { title, description } = localizeGame(game, lang);
  const tags = el('ul', { className: 'tags' }, ...game.tags.map((tag) => el('li', { textContent: tagLabel(lang, tag) })));
  const body = el('div', { className: 'body' },
    el('h2', { textContent: title }),
    el('p', { textContent: description }),
    tags,
    el('span', { className: 'play', textContent: t(lang, 'play') }));
  return el('li', {}, el('a', { className: 'card', href: gameHref(game, lang) }, art, body));
}

function setStatus(key) {
  statusKey = key;
  status.textContent = key ? t(lang, key) : '';
}

// Static texts carry data-i18n (text), data-i18n-html (markup from STRINGS only, never from games.json) or
// data-i18n-aria (aria-label).
function applyLang() {
  document.documentElement.lang = lang;
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(lang, node.dataset.i18n);
  for (const node of document.querySelectorAll('[data-i18n-html]')) node.innerHTML = t(lang, node.dataset.i18nHtml);
  for (const node of document.querySelectorAll('[data-i18n-aria]')) node.setAttribute('aria-label', t(lang, node.dataset.i18nAria));
  for (const b of document.querySelectorAll('#lang [data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  setStatus(statusKey);
  if (games) list.replaceChildren(...games.map(card));
}

// EN / SV switch (L-9): the choice is remembered and passed on to the games via the card links.
function setupLang() {
  document.getElementById('lang').addEventListener('click', (e) => {
    const next = normalizeLang(e.target.closest('[data-lang]')?.dataset.lang);
    if (!next || next === lang) return;
    lang = next;
    storage.set(LANG_KEY, lang);
    applyLang();
  });
  applyLang();
}

async function main() {
  try {
    const res = await fetch('games.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    games = sortGames(await res.json());
    list.replaceChildren(...games.map(card));
    setStatus(games.length ? '' : 'empty');
  } catch (e) {
    setStatus('error');
  }
}

// Install as an app (L-7, D-6): a native prompt where the browser offers one, Share > Add to Home Screen steps on iOS.
// No service worker: Chromium no longer needs one to install, and the root sw.js is reserved (D-2).
function setupInstall() {
  const button = document.getElementById('install');
  const ios = document.getElementById('ios-install');
  let deferred = null;
  let installed = false;
  const isIOS = detectIOS({ userAgent: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints || 0 });
  const isStandalone = () => detectStandalone({
    navStandalone: navigator.standalone === true,
    standaloneMQ: matchMedia('(display-mode: standalone)').matches,
    fullscreenMQ: matchMedia('(display-mode: fullscreen)').matches,
    touchHardware: (navigator.maxTouchPoints || 0) > 0 || matchMedia('(pointer: coarse)').matches,
    referrer: document.referrer,
  });
  const kind = () => installKind({ isStandalone: isStandalone(), installed, hasDeferredPrompt: !!deferred, isIOS });
  const refresh = () => {
    button.hidden = kind() === 'none';
    if (button.hidden) ios.hidden = true;
  };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // prompt from our own button instead of the browser's mini-infobar
    deferred = e;
    refresh();
  });
  window.addEventListener('appinstalled', () => { installed = true; deferred = null; refresh(); });
  button.addEventListener('click', async () => {
    if (kind() === 'native') {
      const prompt = deferred;
      deferred = null; // each event can prompt once
      try {
        await prompt.prompt();
        if ((await prompt.userChoice).outcome === 'accepted') installed = true;
      } catch (_) { /* the browser refused to show it: treat as dismissed */ }
      refresh();
    } else if (kind() === 'ios-instructions') {
      ios.hidden = false;
      document.getElementById('ios-install-close').focus();
    }
  });
  document.getElementById('ios-install-close').addEventListener('click', () => { ios.hidden = true; button.focus(); });
  refresh();
}

setupLang();
setupInstall();

main();
