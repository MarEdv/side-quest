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
    // Leave browser shortcuts (Cmd/Ctrl+R, Cmd+W, ...) alone. Also, macOS sends no keyup for keys released
    // while Cmd is held, so recording them would leave e.g. "left" stuck after Cmd+A.
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (GAME_KEYS.has(e.code)) e.preventDefault(); // no page scroll on arrows/space
    down.add(e.code);
  });
  target.addEventListener('keyup', (e) => {
    down.delete(e.code);
    if (e.key === 'Meta') down.clear(); // see above: other keys' keyups may have been swallowed
  });
  target.addEventListener('blur', () => down.clear());
  const state = {};
  return {
    read() {
      for (const [name, codes] of Object.entries(KEYMAP)) state[name] = codes.some((c) => down.has(c));
      return state;
    },
    anyKeyDown: () => down.size > 0,
    clear: () => down.clear(),
  };
}
