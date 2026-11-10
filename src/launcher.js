// Launcher: reads games.json and renders one card per game. Browser glue only; the rules live in registry.js.
import { sortGames } from './registry.js';
import { installKind, detectIOS, detectStandalone } from './installmodel.js';

const list = document.getElementById('games');
const status = document.getElementById('status');

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function card(game) {
  const art = el('div', { className: 'art' });
  if (game.thumbnail) art.append(el('img', { src: game.thumbnail, alt: '', loading: 'lazy' }));
  else art.append(el('span', { ariaHidden: 'true', textContent: game.icon || '🎮' }));
  const tags = el('ul', { className: 'tags' }, ...game.tags.map((t) => el('li', { textContent: t })));
  const body = el('div', { className: 'body' },
    el('h2', { textContent: game.title }),
    el('p', { textContent: game.description }),
    tags,
    el('span', { className: 'play', textContent: 'Play →' }));
  return el('li', {}, el('a', { className: 'card', href: game.path }, art, body));
}

async function main() {
  try {
    const res = await fetch('games.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const games = sortGames(await res.json());
    list.replaceChildren(...games.map(card));
    status.textContent = games.length ? '' : 'No games yet.';
  } catch (e) {
    status.textContent = 'Could not load the game list. Try reloading the page.';
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

setupInstall();

main();
