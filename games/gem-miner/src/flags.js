// Feature flags parsed from the URL query string (REQUIREMENTS 3.7). Pure: no DOM access, the caller passes
// `location.search`. Unknown or invalid values fall back to the default.
export const WORLD_SIZES = Object.freeze([256, 128, 512]);

export const DEFAULT_FLAGS = Object.freeze({
  worldSize: 256, seed: null, camera: 'deadzone', fog: true, durability: false,
  touch: 'auto', touchControls: 'dpad', sound: true, debug: false,
});

const pick = (p, name, allowed, dflt) => { const v = p.get(name); return allowed.includes(v) ? v : dflt; };
const bool = (p, name, dflt) => { const v = p.get(name); return v === '1' ? true : v === '0' ? false : dflt; };

export function parseFlags(search = '') {
  const p = new URLSearchParams(search);
  const out = { ...DEFAULT_FLAGS };
  const ws = Number(p.get('worldSize'));
  if (WORLD_SIZES.includes(ws)) out.worldSize = ws;
  const sd = p.get('seed');
  if (sd !== null && /^\d{1,10}$/.test(sd.trim())) {
    const n = Number(sd.trim());
    if (n <= 0x7fffffff) out.seed = n;
  }
  out.camera = pick(p, 'camera', ['deadzone', 'center'], out.camera);
  out.fog = bool(p, 'fog', out.fog);
  out.durability = bool(p, 'durability', out.durability);
  out.touch = pick(p, 'touch', ['auto', 'on', 'off'], out.touch);
  out.touchControls = pick(p, 'touchControls', ['dpad', 'joystick'], out.touchControls);
  out.sound = bool(p, 'sound', out.sound);
  out.debug = p.get('debug') === '1';
  return out;
}
