// Touch controls (browser only). A DOM overlay above the canvas driven by Pointer Events, tracked per pointerId
// so steering and the action button work at the same time. Produces the input.js shape plus analog moveX/moveY.
// start / restart / pause are "pulses": they stay true until ack() (main calls it after a sim step ran), so a quick
// tap is never lost on a frame that ran zero fixed steps; game.js turns them into edges.
import {
  STICK_RADIUS, joystickVector, clampOffset, screenToGame, tapWalkVector, tapIntent, touchActive,
} from './touchmath.js';

const END_GUARD_MS = 700; // ignore taps right after the game ends so a mashed action button doesn't restart it

export function createTouch({ mode = 'auto', scheme = 'joystick', root = document.body, onChange = () => {} } = {}) {
  if (mode === 'off') {
    return { enabled: false, active: () => false, read: () => ({}), ack() {}, clear() {}, setLayout() {}, refresh() {} };
  }
  const mk = (cls, parent, text = '') => {
    const el = document.createElement('div');
    el.className = cls; el.textContent = text; parent.appendChild(el); return el;
  };
  const overlay = mk('tc', root);
  overlay.id = 'touch';
  overlay.dataset.scheme = scheme;
  const idle = mk('tc-idle', overlay);
  const base = mk('tc-base', overlay), knob = mk('tc-knob', base);
  const actionBtn = mk('tc-action', overlay, 'WORK');
  const pauseBtn = mk('tc-pause', overlay, 'Ⅱ');
  const marker = mk('tc-marker', overlay);
  pauseBtn.setAttribute('aria-label', 'Pause');

  let hasTouch = mode === 'auto' && (
    (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints || 0) > 0);
  let active = touchActive(mode, hasTouch);
  const sync = () => { overlay.classList.toggle('on', active); onChange(active); };
  sync();

  let layout = { left: 0, top: 0, scale: 1 };
  let phase = 'title', endedAt = 0;
  const ptrs = new Map(); // pointerId -> { role, ox, oy, x, y }
  const pulse = { pause: false, start: false, restart: false };

  const byRole = (role) => { for (const p of ptrs.values()) if (p.role === role) return p; return null; };
  const now = () => performance.now();

  overlay.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && mode !== 'on') return;
    e.preventDefault();
    if (!active && mode === 'auto') { hasTouch = true; active = true; sync(); }
    try { overlay.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    let role = 'ui'; // 'ui' pointers never steer or work, even after the phase changes (the start tap stays inert)
    if (e.target === pauseBtn) {
      if (phase === 'playing' || phase === 'paused') pulse.pause = true;
    } else if (phase === 'title') pulse.start = true;
    else if (phase === 'paused') pulse.pause = true;
    else if (phase === 'won' || phase === 'lost') { if (now() - endedAt > END_GUARD_MS) pulse.restart = true; }
    else if (phase === 'playing') {
      if (scheme === 'tap') { if (!byRole('walk')) role = 'walk'; }
      else if (e.target === actionBtn) role = 'action';
      else if (e.clientX < innerWidth / 2 && !byRole('stick')) role = 'stick';
    }
    ptrs.set(e.pointerId, { role, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY });
  });
  overlay.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (p) { e.preventDefault(); p.x = e.clientX; p.y = e.clientY; }
  });
  const up = (e) => { ptrs.delete(e.pointerId); };
  overlay.addEventListener('pointerup', up);
  overlay.addEventListener('pointercancel', up);
  overlay.addEventListener('lostpointercapture', up);
  overlay.addEventListener('contextmenu', (e) => e.preventDefault());

  const place = (el, x, y) => { el.style.transform = `translate(${x}px, ${y}px)`; };

  function read(state) {
    if (state.phase !== phase) {
      phase = state.phase;
      if (phase === 'won' || phase === 'lost') endedAt = now();
    }
    overlay.dataset.phase = phase;
    const out = { up: false, down: false, left: false, right: false, action: false, moveX: 0, moveY: 0, ...pulse };
    const stick = byRole('stick'), walk = byRole('walk'), act = byRole('action');
    base.classList.toggle('show', !!stick);
    overlay.classList.toggle('steer', !!stick);
    marker.classList.toggle('show', !!walk);
    actionBtn.classList.toggle('down', !!act);
    if (phase !== 'playing') return out;
    if (stick) {
      const v = joystickVector(stick.x - stick.ox, stick.y - stick.oy);
      out.moveX = v.x; out.moveY = v.y;
      place(base, stick.ox, stick.oy);
      const k = clampOffset(stick.x - stick.ox, stick.y - stick.oy, STICK_RADIUS);
      place(knob, k.x, k.y);
    }
    if (act) out.action = true;
    if (walk) {
      const pt = screenToGame(walk.x, walk.y, layout);
      const { target, action } = tapIntent(state, pt);
      const v = tapWalkVector(state.player, target);
      out.moveX = v.x; out.moveY = v.y; out.action = action;
      place(marker, walk.x, walk.y);
      marker.classList.toggle('work', action);
    }
    return out;
  }

  return {
    enabled: true,
    active: () => active,
    read,
    ack() { pulse.pause = pulse.start = pulse.restart = false; },
    clear() { ptrs.clear(); pulse.pause = pulse.start = pulse.restart = false; },
    setLayout(l, ui = {}) {
      // Rotation re-maps client coordinates: a held stick's origin would be stale and make the player run off
      // (seen in emulation). Drop all pointers; the fingers still down simply become inert until lifted (D-19).
      if (l.portrait !== layout.portrait) { ptrs.clear(); }
      layout = l;
      pauseBtn.style.top = ui.pauseTop == null ? '' : `${ui.pauseTop}px`;
    },
    // Position helper for main.js: dock the rotate hint etc. is done in CSS; nothing to do here.
    refresh: sync,
  };
}
