// Keyboard + Pointer Events input. Produces { moveX, moveY, target } for game.update.
// Pointer handling depends on the `controls` flag:
//   tap      -> every pointer sets a walk target
//   joystick -> every pointer on the left half drives a virtual stick
//   auto     -> touch pointers use the joystick, mouse/pen click-to-move (+ keyboard)
export function createInput(canvas, { mode, toWorld, onPause }) {
  const keys = new Set();
  const joy = { active: false, id: null, bx: 0, by: 0, sx: 0, sy: 0, dx: 0, dy: 0, radius: 56 };
  let target = null;
  let targetSeq = 0;

  const MOVE_KEYS = {
    ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd',
  };

  function onKeyDown(e) {
    if (e.code === 'KeyP' || e.code === 'Escape') { if (!e.repeat) onPause && onPause(); e.preventDefault(); return; }
    if (MOVE_KEYS[e.code]) { keys.add(MOVE_KEYS[e.code]); e.preventDefault(); }
  }
  function onKeyUp(e) { if (MOVE_KEYS[e.code]) keys.delete(MOVE_KEYS[e.code]); }

  const useJoystick = (e) => mode === 'joystick' || (mode === 'auto' && e.pointerType === 'touch');

  function onPointerDown(e) {
    if (e.target !== canvas) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    if (useJoystick(e)) {
      if (joy.active || e.clientX > window.innerWidth * 0.5) return;
      Object.assign(joy, { active: true, id: e.pointerId, bx: e.clientX, by: e.clientY, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0 });
    } else {
      const w = toWorld(e.clientX, e.clientY);
      target = { id: ++targetSeq, x: w.x, y: w.y };
    }
  }
  function onPointerMove(e) {
    if (joy.active && e.pointerId === joy.id) {
      let dx = e.clientX - joy.bx, dy = e.clientY - joy.by;
      const d = Math.hypot(dx, dy);
      if (d > joy.radius) { dx = (dx / d) * joy.radius; dy = (dy / d) * joy.radius; }
      joy.sx = joy.bx + dx; joy.sy = joy.by + dy;
      joy.dx = dx / joy.radius; joy.dy = dy / joy.radius;
    } else if (!useJoystick(e) && e.buttons && e.pointerType !== 'touch' && e.target === canvas) {
      // dragging with the mouse keeps retargeting
      const w = toWorld(e.clientX, e.clientY);
      target = { id: ++targetSeq, x: w.x, y: w.y };
    }
  }
  function onPointerUp(e) {
    if (joy.active && e.pointerId === joy.id) { joy.active = false; joy.dx = joy.dy = 0; }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => { keys.clear(); joy.active = false; joy.dx = joy.dy = 0; });
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    joy,
    read() {
      let mx = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0);
      let my = (keys.has('d') ? 1 : 0) - (keys.has('u') ? 1 : 0);
      if (joy.active) { mx += joy.dx; my += joy.dy; }
      return { moveX: mx, moveY: my, target };
    },
    reset() { keys.clear(); joy.active = false; joy.dx = joy.dy = 0; target = null; },
    get showJoystick() { return mode === 'joystick' || mode === 'auto'; },
  };
}
