// Pure helpers for the DOM menus (src/ui.js) and the game/menu hand-off. No DOM.

// Which game inputs may reach update() in each phase. While a menu is shown the game must not see walking,
// "action" (Space on a menu button) or "start" (Enter on a button would start/leave a screen twice).
export function gateInput(phase, inp) {
  const out = { up: false, down: false, left: false, right: false, action: false, pause: false, start: false, restart: false, moveX: 0, moveY: 0 };
  if (phase === 'playing') return { ...out, ...inp, start: false, restart: false };
  if (phase === 'paused') return { ...out, pause: !!inp.pause };
  if (phase === 'won' || phase === 'lost') return { ...out, restart: !!inp.restart };
  return out; // title: the main menu is DOM, nothing from the game inputs applies
}

export const rankText = (res) => (!res || res.rank == null ? '' : res.isBest ? 'New high score!' : `#${res.rank} on your board`);
export const bestText = (res) => (!res || res.best == null ? '' : `Best: ${res.best}`);

// Short, locale-formatted date for the table; '' for missing or unparseable dates.
export function formatDate(iso, locale) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  try { return new Date(t).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return ''; }
}

// Arrow-key focus movement over `count` items: up/left = previous, down/right = next, wrapping. Returns the new index.
export function moveFocus(count, cur, key) {
  if (count <= 0) return -1;
  const dir = key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : key === 'ArrowDown' || key === 'ArrowRight' ? 1 : 0;
  if (!dir) return cur;
  if (cur < 0 || cur >= count) return dir > 0 ? 0 : count - 1;
  return (cur + dir + count) % count;
}
