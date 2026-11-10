// Launcher: reads games.json and renders one card per game. Browser glue only; the rules live in registry.js.
import { sortGames } from './registry.js';

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

// The old Side Quest home-screen app opens this page now (its start URL used to be the site root).
if (matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches) {
  document.getElementById('moved').hidden = false;
}

main();
