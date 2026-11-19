// Keyboard + touch input (C-1, C-2, C-3; browser only). read() returns one input object for a fixed step:
//   { left, right, action, actionPressed, pick, accept, decline }
// The held parts (left / right / action) reflect the keys and fingers now; the edges (actionPressed, pick, accept,
// decline) stay set until read() hands them out once, so a quick tap is never lost and never counted twice. The
// caller calls read() once per frame that runs a step and passes `held(inp)` to any further steps of that frame.
// While isBlocked() is true (a menu is open) nothing is recorded, so no input leaks into the game.
const PICKS = { Digit1: 'coffee', Numpad1: 'coffee', Digit2: 'snack', Numpad2: 'snack', Digit3: 'water', Numpad3: 'water',
  Digit0: 'none', Numpad0: 'none', Backspace: 'none' };
const LEFT = ['ArrowLeft', 'KeyA'], RIGHT = ['ArrowRight', 'KeyD'], ACT = ['Space', 'KeyE'];

// Touch controls show on coarse-pointer devices (auto), always (on) or never (off).
export const touchActive = (mode, hasTouch) => (mode === 'on' ? true : mode === 'off' ? false : !!hasTouch);

// The same step without the edges: for the 2nd.. steps of a frame.
export const held = (i) => ({ left: i.left, right: i.right, action: i.action, actionPressed: false, pick: null, accept: false, decline: false });

export function createInput({ touchMode = 'auto', isBlocked = () => false, onPause = () => {} } = {}) {
  const keys = new Set();
  const walk = new Map();        // pointerId -> 'left' | 'right'
  const act = new Set();         // pointerIds holding the action button
  const edge = { actionPressed: false, pick: null, accept: false, decline: false };
  let hasTouch = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints || 0) > 0;
  const listeners = new Set();
  const notify = () => listeners.forEach((f) => f(touchActive(touchMode, hasTouch)));
  const touchEl = document.getElementById('touch');
  const pad = document.getElementById('walkpad'), actionBtn = document.getElementById('actionBtn');
  const padBtns = [...pad.querySelectorAll('button')];

  const any = (codes) => codes.some((c) => keys.has(c));
  const clearAll = () => { keys.clear(); walk.clear(); act.clear(); paint(); };
  const paint = () => {
    const l = [...walk.values()].includes('left'), r = [...walk.values()].includes('right');
    padBtns[0].classList.toggle('on', l); padBtns[1].classList.toggle('on', r);
    actionBtn.classList.toggle('on', act.size > 0);
  };

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const c = e.code;
    if (c === 'KeyP' || c === 'Escape') { if (!e.repeat) { e.preventDefault(); onPause(); } return; }
    if (isBlocked()) return;
    if (LEFT.includes(c) || RIGHT.includes(c)) { e.preventDefault(); keys.add(c); }
    else if (ACT.includes(c)) { e.preventDefault(); if (!e.repeat && !any(ACT)) edge.actionPressed = true; keys.add(c); }
    else if (PICKS[c]) { e.preventDefault(); if (!e.repeat) edge.pick = PICKS[c]; }
    else if (c === 'KeyY') { e.preventDefault(); if (!e.repeat) edge.accept = true; }
    else if (c === 'KeyN') { e.preventDefault(); if (!e.repeat) edge.decline = true; }
  });
  window.addEventListener('keyup', (e) => { keys.delete(e.code); });
  // Keys and fingers released while the page was in the background never send their up event.
  window.addEventListener('blur', clearAll);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') clearAll(); });

  // Walk pad: the side of the pad a finger is on decides the direction, so sliding between ◀ and ▶ works.
  const sideOf = (e) => { const r = pad.getBoundingClientRect(); return e.clientX < r.left + r.width / 2 ? 'left' : 'right'; };
  const begin = (e) => { if (!hasTouch && e.pointerType !== 'mouse') { hasTouch = true; notify(); } };
  pad.addEventListener('pointerdown', (e) => {
    if (isBlocked()) return;
    e.preventDefault(); begin(e);
    try { pad.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    walk.set(e.pointerId, sideOf(e)); paint();
  });
  pad.addEventListener('pointermove', (e) => { if (walk.has(e.pointerId)) { e.preventDefault(); walk.set(e.pointerId, sideOf(e)); paint(); } });
  const padUp = (e) => { if (walk.delete(e.pointerId)) paint(); };
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(t, padUp);

  // Action button: down is the edge, holding it holds the action.
  actionBtn.addEventListener('pointerdown', (e) => {
    if (isBlocked()) return;
    e.preventDefault(); begin(e);
    try { actionBtn.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    if (!act.size) edge.actionPressed = true;
    act.add(e.pointerId); paint();
  });
  const actUp = (e) => { if (act.delete(e.pointerId)) paint(); };
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) actionBtn.addEventListener(t, actUp);

  // No page scroll / zoom / selection while playing (iOS Safari ignores touch-action in places).
  const block = (e) => { if (!(e.target && e.target.closest && e.target.closest('.screen'))) e.preventDefault(); };
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', block, { passive: false });
  document.addEventListener('contextmenu', (e) => { if (touchActive(touchMode, hasTouch)) e.preventDefault(); });
  document.addEventListener('touchstart', () => { if (!hasTouch) { hasTouch = true; notify(); } }, { passive: true });

  return {
    read() {
      const out = {
        left: any(LEFT) || [...walk.values()].includes('left'), right: any(RIGHT) || [...walk.values()].includes('right'),
        action: any(ACT) || act.size > 0, ...edge,
      };
      if (out.left && out.right) out.left = out.right = false;
      edge.actionPressed = false; edge.pick = null; edge.accept = false; edge.decline = false;
      return out;
    },
    // Edges raised by the on-screen buttons (offer card, café picker).
    pick(name) { if (!isBlocked()) edge.pick = name; },
    accept() { if (!isBlocked()) edge.accept = true; },
    decline() { if (!isBlocked()) edge.decline = true; },
    // Drop everything held and pending (a menu opened, the game started).
    reset() { clearAll(); edge.actionPressed = false; edge.pick = null; edge.accept = false; edge.decline = false; },
    touchActive: () => touchActive(touchMode, hasTouch),
    onTouchChange(f) { listeners.add(f); },
    showTouch(v) { touchEl.hidden = !v; document.body.classList.toggle('touch', !!v); },
  };
}
