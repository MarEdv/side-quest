// Keyboard + touch input (K-1, K-2, K-3; browser only). read() returns one input object for a fixed step:
//   { left, right, gas, brake, leftPressed, rightPressed }
// The held parts reflect the keys and fingers now; the edges (leftPressed, rightPressed, for steer=lanes) stay set until
// read() hands them out once, so a quick tap is never lost and never counted twice. The caller calls read() once per
// frame that runs a step and passes `held(inp)` to any further steps of that frame. While isBlocked() is true (a menu
// is open) nothing is recorded, so no input leaks into the game.
const LEFT = ['ArrowLeft', 'KeyA'], RIGHT = ['ArrowRight', 'KeyD'], GAS = ['ArrowUp', 'KeyW'], BRAKE = ['ArrowDown', 'KeyS', 'Space'];

// Touch controls show on coarse-pointer devices (auto), always (on) or never (off).
export const touchActive = (mode, hasTouch) => (mode === 'on' ? true : mode === 'off' ? false : !!hasTouch);

// The same step without the edges: for the 2nd.. steps of a frame.
export const held = (i) => ({ left: i.left, right: i.right, gas: i.gas, brake: i.brake, leftPressed: false, rightPressed: false });

export function createInput({ touchMode = 'auto', isBlocked = () => false, onPause = () => {} } = {}) {
  const keys = new Set();
  const steer = new Map();       // pointerId -> 'left' | 'right'
  const pedal = new Map();       // pointerId -> 'gas' | 'brake'
  const edge = { leftPressed: false, rightPressed: false };
  let hasTouch = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints || 0) > 0;
  const listeners = new Set();
  const notify = () => listeners.forEach((f) => f(touchActive(touchMode, hasTouch)));
  const touchEl = document.getElementById('touch');
  const pad = document.getElementById('steerpad');
  const padBtns = [...pad.querySelectorAll('button')];
  const pedalBtns = { gas: document.getElementById('gasBtn'), brake: document.getElementById('brakeBtn') };

  const any = (codes) => codes.some((c) => keys.has(c));
  const fingers = (map, v) => [...map.values()].includes(v);
  const clearAll = () => { keys.clear(); steer.clear(); pedal.clear(); paint(); };
  const paint = () => {
    padBtns[0].classList.toggle('on', fingers(steer, 'left')); padBtns[1].classList.toggle('on', fingers(steer, 'right'));
    for (const k of Object.keys(pedalBtns)) pedalBtns[k].classList.toggle('on', fingers(pedal, k));
  };

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const c = e.code;
    if (c === 'KeyP' || c === 'Escape') { if (!e.repeat) { e.preventDefault(); onPause(); } return; }
    if (isBlocked()) return;
    if (LEFT.includes(c)) { e.preventDefault(); if (!e.repeat && !any(LEFT)) edge.leftPressed = true; keys.add(c); }
    else if (RIGHT.includes(c)) { e.preventDefault(); if (!e.repeat && !any(RIGHT)) edge.rightPressed = true; keys.add(c); }
    else if (GAS.includes(c) || BRAKE.includes(c)) { e.preventDefault(); keys.add(c); }
  });
  window.addEventListener('keyup', (e) => { keys.delete(e.code); });
  // Keys and fingers released while the page was in the background never send their up event.
  window.addEventListener('blur', clearAll);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') clearAll(); });

  // Steer pad: the side of the pad a finger is on decides the direction, so sliding between ◀ and ▶ works.
  const sideOf = (e) => { const r = pad.getBoundingClientRect(); return e.clientX < r.left + r.width / 2 ? 'left' : 'right'; };
  const begin = (e) => { if (!hasTouch && e.pointerType !== 'mouse') { hasTouch = true; notify(); } };
  const setSide = (id, side) => {
    if (side === 'left' && !fingers(steer, 'left')) edge.leftPressed = true;
    if (side === 'right' && !fingers(steer, 'right')) edge.rightPressed = true;
    steer.set(id, side); paint();
  };
  pad.addEventListener('pointerdown', (e) => {
    if (isBlocked()) return;
    e.preventDefault(); begin(e);
    try { pad.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    setSide(e.pointerId, sideOf(e));
  });
  pad.addEventListener('pointermove', (e) => { if (steer.has(e.pointerId)) { e.preventDefault(); const s = sideOf(e); if (steer.get(e.pointerId) !== s) setSide(e.pointerId, s); } });
  const padUp = (e) => { if (steer.delete(e.pointerId)) paint(); };
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(t, padUp);

  // Pedals: a finger holds one while it is down on it.
  for (const [name, btn] of Object.entries(pedalBtns)) {
    btn.addEventListener('pointerdown', (e) => {
      if (isBlocked()) return;
      e.preventDefault(); begin(e);
      try { btn.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      pedal.set(e.pointerId, name); paint();
    });
    const up = (e) => { if (pedal.delete(e.pointerId)) paint(); };
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(t, up);
  }

  // No page scroll / zoom / selection while playing (iOS Safari ignores touch-action in places).
  const block = (e) => { if (!(e.target && e.target.closest && e.target.closest('.screen'))) e.preventDefault(); };
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', block, { passive: false });
  document.addEventListener('contextmenu', (e) => { if (touchActive(touchMode, hasTouch)) e.preventDefault(); });
  document.addEventListener('touchstart', () => { if (!hasTouch) { hasTouch = true; notify(); } }, { passive: true });

  return {
    read() {
      const out = {
        left: any(LEFT) || fingers(steer, 'left'), right: any(RIGHT) || fingers(steer, 'right'),
        gas: any(GAS) || fingers(pedal, 'gas'), brake: any(BRAKE) || fingers(pedal, 'brake'), ...edge,
      };
      if (out.left && out.right) out.left = out.right = false;
      edge.leftPressed = false; edge.rightPressed = false;
      return out;
    },
    // Drop everything held and pending (a menu opened, the game started).
    reset() { clearAll(); edge.leftPressed = false; edge.rightPressed = false; },
    touchActive: () => touchActive(touchMode, hasTouch),
    onTouchChange(f) { listeners.add(f); },
    showTouch(v) { touchEl.hidden = !v; document.body.classList.toggle('touch', !!v); },
  };
}
