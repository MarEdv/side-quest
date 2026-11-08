// Keyboard input -> level-triggered booleans. game.js does the edge detection for pause/start/restart.
const KEYMAP = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  action: ['Space', 'KeyE'],
  pause: ['KeyP', 'Escape'],
  start: ['Space', 'Enter'],
  restart: ['KeyR'],
};
const GAME_KEYS = new Set(Object.values(KEYMAP).flat());

export function createInput(target = window) {
  const down = new Set();
  target.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    down.add(e.code);
  });
  target.addEventListener('keyup', (e) => down.delete(e.code));
  target.addEventListener('blur', () => down.clear());
  const state = {};
  return {
    read() {
      for (const [name, codes] of Object.entries(KEYMAP)) state[name] = codes.some((c) => down.has(c));
      return state;
    },
    anyKeyDown: () => down.size > 0,
  };
}
