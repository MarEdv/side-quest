// Keyboard + touch input (browser only). read() returns { dx, dy, shop, map, pause }: dx/dy are held directions (one axis
// at a time, the most recently pressed key wins); shop/map/pause are one-shot pulses. While `isBlocked()` is true (an
// overlay is open) nothing is recorded, so no input leaks into the game.
import { stickDir, clampKnob, touchActive, STICK_RADIUS } from './touchmath.js';

const KEYDIR = {
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
};

export function createInput({ touchMode = 'auto', scheme = 'dpad', isBlocked = () => false } = {}) {
  const held = [];                  // keyboard direction codes, oldest first
  const pulse = { shop: false, map: false, pause: false };
  let touchDir = { dx: 0, dy: 0 };
  let hasTouch = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints || 0) > 0;
  const touchEl = document.getElementById('touch');
  const shopBtn = document.getElementById('shopBtn');
  const dpad = document.getElementById('dpad'), stick = document.getElementById('stick'), knob = document.getElementById('stickKnob');
  touchEl.dataset.scheme = scheme;
  const listeners = new Set();
  const notify = () => listeners.forEach((f) => f(touchActive(touchMode, hasTouch)));

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const code = e.code;
    if (isBlocked()) return;
    if (KEYDIR[code]) {
      e.preventDefault();
      if (!held.includes(code)) held.push(code);
    } else if (code === 'KeyE' || code === 'Enter') { e.preventDefault(); if (!e.repeat) pulse.shop = true; }
    else if (code === 'KeyM') { e.preventDefault(); if (!e.repeat) pulse.map = true; }
    else if (code === 'KeyP' || code === 'Escape') { e.preventDefault(); if (!e.repeat) pulse.pause = true; }
  });
  window.addEventListener('keyup', (e) => { const k = held.indexOf(e.code); if (k >= 0) held.splice(k, 1); });
  // Keys released while the page was in the background never send keyup: drop everything held (mobile app switch fires
  // visibilitychange without blur).
  window.addEventListener('blur', () => { held.length = 0; clearTouch(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { held.length = 0; clearTouch(); } });

  // --- touch: d-pad (direction from the finger's position relative to the pad centre, so sliding works) ---
  const dpadBtns = [...dpad.querySelectorAll('button')];
  const setDpadClass = (d) => dpadBtns.forEach((b) => b.classList.toggle('on', b.dataset.d === d));
  let dpadPtr = null;
  const dpadFrom = (e) => {
    const r = dpad.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const ox = e.clientX - cx, oy = e.clientY - cy;
    const d = stickDir(ox, oy, r.width / 2, 0.16);
    touchDir = d;
    setDpadClass(d.dy < 0 ? 'up' : d.dy > 0 ? 'down' : d.dx < 0 ? 'left' : d.dx > 0 ? 'right' : '');
  };
  dpad.addEventListener('pointerdown', (e) => {
    if (isBlocked()) return;
    e.preventDefault(); if (!hasTouch && e.pointerType !== 'mouse') { hasTouch = true; notify(); }
    dpadPtr = e.pointerId; try { dpad.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    dpadFrom(e);
  });
  dpad.addEventListener('pointermove', (e) => { if (e.pointerId === dpadPtr) { e.preventDefault(); dpadFrom(e); } });
  const dpadUp = (e) => { if (e.pointerId === dpadPtr) { dpadPtr = null; touchDir = { dx: 0, dy: 0 }; setDpadClass(''); } };
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) dpad.addEventListener(t, dpadUp);

  // --- touch: joystick ---
  let stickPtr = null;
  const stickFrom = (e) => {
    const r = stick.getBoundingClientRect(), ox = e.clientX - (r.left + r.width / 2), oy = e.clientY - (r.top + r.height / 2);
    touchDir = stickDir(ox, oy, STICK_RADIUS * 1.2);
    const k = clampKnob(ox, oy, r.width / 2 - 28);
    knob.style.transform = `translate(${k.x}px, ${k.y}px)`;
  };
  stick.addEventListener('pointerdown', (e) => {
    if (isBlocked()) return;
    e.preventDefault(); stickPtr = e.pointerId; try { stick.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    stickFrom(e);
  });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickPtr) { e.preventDefault(); stickFrom(e); } });
  const stickUp = (e) => { if (e.pointerId === stickPtr) { stickPtr = null; touchDir = { dx: 0, dy: 0 }; knob.style.transform = ''; } };
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(t, stickUp);

  shopBtn.addEventListener('click', (e) => { e.preventDefault(); if (!isBlocked()) pulse.shop = true; });

  // No page scroll / zoom / pinch while playing (iOS belt and braces next to touch-action: none).
  const block = (e) => { if (!(e.target && e.target.closest && e.target.closest('.screen'))) e.preventDefault(); };
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', block, { passive: false });
  document.addEventListener('contextmenu', (e) => { if (touchActive(touchMode, hasTouch)) e.preventDefault(); });
  document.addEventListener('touchstart', () => { if (!hasTouch) { hasTouch = true; notify(); } }, { passive: true });

  function clearTouch() {
    dpadPtr = stickPtr = null; touchDir = { dx: 0, dy: 0 }; setDpadClass(''); knob.style.transform = '';
  }

  return {
    read() {
      let dx = 0, dy = 0;
      if (held.length) { const [a, b] = KEYDIR[held[held.length - 1]]; dx = a; dy = b; }
      else { dx = touchDir.dx; dy = touchDir.dy; }
      const out = { dx, dy, shop: pulse.shop, map: pulse.map, pause: pulse.pause };
      pulse.shop = pulse.map = pulse.pause = false;
      return out;
    },
    // Drop everything held / pending (called when an overlay opens or the game starts).
    reset() { held.length = 0; pulse.shop = pulse.map = pulse.pause = false; clearTouch(); },
    touchActive: () => touchActive(touchMode, hasTouch),
    onTouchChange(f) { listeners.add(f); },
    showShop(v) { shopBtn.hidden = !v; },
  };
}
