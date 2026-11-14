// Pure helpers for touch input: joystick vector -> one of four directions.
export const STICK_RADIUS = 56;   // CSS px the knob can travel
export const STICK_DEAD = 0.28;   // fraction of the radius ignored

// Finger offset from the stick origin -> {dx, dy} with exactly one non-zero axis (the dominant one), or zeros.
export function stickDir(ox, oy, radius = STICK_RADIUS, dead = STICK_DEAD) {
  if (Math.hypot(ox, oy) < radius * dead) return { dx: 0, dy: 0 };
  if (Math.abs(ox) >= Math.abs(oy)) return { dx: ox > 0 ? 1 : -1, dy: 0 };
  return { dx: 0, dy: oy > 0 ? 1 : -1 };
}

// Knob position clamped to the radius.
export function clampKnob(ox, oy, radius = STICK_RADIUS) {
  const len = Math.hypot(ox, oy);
  return len <= radius ? { x: ox, y: oy } : { x: ox / len * radius, y: oy / len * radius };
}

export const touchActive = (mode, hasTouch) => mode === 'on' || (mode === 'auto' && !!hasTouch);
