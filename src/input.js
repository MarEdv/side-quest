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

const isField = (t) => !!(t && t.tagName && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) && !(t.type === 'checkbox'));

export function createInput(target = window) {
  const down = new Set();
  target.addEventListener('keydown', (e) => {
    // Leave browser shortcuts (Cmd/Ctrl+R, Cmd+W, ...) alone. Also, macOS sends no keyup for keys released
    // while Cmd is held, so recording them would leave e.g. "left" stuck after Cmd+A.
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // Typing in a form field (Settings number / seed inputs, selects) is never game input: no walking, no preventDefault.
    if (isField(e.target)) return;
    // A key the menu (ui.js, capture phase) already handled is not game input either: Esc that closes Settings over the
    // pause screen must not also reach game.js as a pause toggle and resume the day (D-24).
    if (e.defaultPrevented) return;
    // Space/Enter on a menu button belong to the button (activate it), not the game: no preventDefault, no "action".
    if ((e.code === 'Space' || e.code === 'Enter') && e.target && e.target.closest && e.target.closest('.ui button, .ui input[type="checkbox"]')) return;
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
