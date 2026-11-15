// Launcher: reads games.json and renders one card per game. Browser glue only; the rules live in registry.js.
import { sortGames } from './registry.js';
import { installKind, detectIOS, detectStandalone } from './installmodel.js';
import { createStorage } from '../kit/storage.js';
import { setupLang } from '../kit/langdom.js';
import { i18n, t, tagLabel, localizeGame, gameHref } from './i18n.js';

const list = document.getElementById('games');
const status = document.getElementById('status');
let games = null;
let statusKey = 'loading';

// Reading window.localStorage can itself throw (blocked storage): the language then just isn't remembered.
let backend = null;
try { backend = window.localStorage; } catch (_) { /* not remembered */ }
const storage = createStorage(backend, 'launcher.');

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function card(game) {
  const art = el('div', { className: 'art' });
  if (game.thumbnail) art.append(el('img', { src: game.thumbnail, alt: '', loading: 'lazy' }));
  else art.append(el('span', { ariaHidden: 'true', textContent: game.icon || '🎮' }));
  const { title, description } = localizeGame(game);
  const tags = el('ul', { className: 'tags' }, ...game.tags.map((tag) => el('li', { textContent: tagLabel(tag) })));
  const body = el('div', { className: 'body' },
    el('h2', { textContent: title }),
    el('p', { textContent: description }),
    tags,
    el('span', { className: 'play', textContent: t('play') }));
  return el('li', {}, el('a', { className: 'card', href: gameHref(game) }, art, body));
}

function setStatus(key) {
  statusKey = key;
  status.textContent = key ? t(key) : '';
}

// EN / SV switch (L-9, K-6): kit/langdom.js picks the language (?lang=, the saved choice, the browser), writes the
// data-i18n texts and runs the switch; what it cannot know is the status line and the cards. The choice is passed on
// to the games via the card links.
const lang = setupLang(i18n, { storage, key: 'lang', onChange: renderLang });

function renderLang() {
  setStatus(statusKey);
  if (games) list.replaceChildren(...games.map(card));
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

lang.bindSwitch(document.getElementById('lang'));
lang.apply();
setupInstall();

main();
