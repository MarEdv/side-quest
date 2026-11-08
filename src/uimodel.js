// Pure helpers for the DOM menus (src/ui.js) and the game/menu hand-off. No DOM.

// Which game inputs may reach update() in each phase. While a menu is shown the game must not see walking,
// "action" (Space on a menu button) or "start" (Enter on a button would start/leave a screen twice).
// `modal` = a sub-screen (Settings, High scores) is open on top of the phase's own screen: it takes every key, so Esc
// from Settings-over-pause goes back instead of also resuming the game.
export function gateInput(phase, inp, modal = false) {
  const out = { up: false, down: false, left: false, right: false, action: false, pause: false, start: false, restart: false, moveX: 0, moveY: 0 };
  if (modal) return out;
  if (phase === 'playing') return { ...out, ...inp, start: false, restart: false };
  if (phase === 'paused') return { ...out, pause: !!inp.pause };
  if (phase === 'won' || phase === 'lost') return { ...out, restart: !!inp.restart };
  return out; // title: the main menu is DOM, nothing from the game inputs applies
}

// Whether a phase change finishes a day that goes on the high-score board (D-22): only playing -> won/lost, so a day
// quit from the pause menu, a restart or a re-render never records, and never in debug mode (its overlay shows the wife's
// state and window.__state is exposed for scripted browser checks, which must not fill the owner's board).
// Whether a phase change begins a new day (Play, Play again, or R on the end screen straight from game.js), as
// opposed to resuming from pause. main.js resets its per-day "debug was on" mark here (D-24).
export const startsDay = (prevPhase, phase) => phase === 'playing' && prevPhase !== 'playing' && prevPhase !== 'paused';

export function shouldRecord(prevPhase, phase, flags) {
  return prevPhase === 'playing' && (phase === 'won' || phase === 'lost') && !(flags && flags.debug);
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

// ---- levels (Features 4 & 5) ----
// End-screen banner for a level day. res = { level: true, best, isBest, won, unlocked (name of a newly opened level or null), note }.
export function levelBannerText(res) {
  if (!res || !res.level) return '';
  const parts = [];
  if (res.isBest) parts.push('New best!');
  if (res.best != null) parts.push(`Level best: ${res.best}`);
  if (res.unlocked) parts.push(`${res.unlocked} unlocked!`);
  if (res.note) parts.push(res.note);
  return parts.join('  ·  ');
}

// What a level card shows. rec = {best, won} or undefined; unlocked comes from levels.js isUnlocked.
export function levelCard(level, index, rec, unlocked, prevName) {
  const best = rec && Number.isFinite(rec.best) ? rec.best : null;
  return {
    title: `${index + 1}. ${level.name}`,
    briefing: level.briefing,
    locked: !unlocked,
    won: !!(rec && rec.won),
    bestText: unlocked ? (best == null ? 'Not played yet' : `Best: ${best}`) : '',
    lockText: unlocked ? '' : `Win ${prevName || 'the previous level'} to unlock it.`,
  };
}

// Which buttons the level end screen offers, in order. next = the following level when it exists and is unlocked.
export function levelEndButtons(won, next) {
  return won && next ? ['next', 'retry', 'menu'] : ['retry', 'menu'];
}
