// Feature flags parsed from the URL query string. Pure; no DOM access.
export const DEFAULT_FLAGS = Object.freeze({ controls: 'auto', poo: 'hit', daySeconds: 180, debug: false });

export function parseFlags(search = '') {
  const p = new URLSearchParams(search);
  const out = { ...DEFAULT_FLAGS };
  const controls = p.get('controls');
  if (['auto', 'tap', 'joystick'].includes(controls)) out.controls = controls;
  const poo = p.get('poo');
  if (['hit', 'choice'].includes(poo)) out.poo = poo;
  const ds = p.get('daySeconds');
  if (ds !== null && ds.trim() !== '') {
    const n = Number(ds);
    if (Number.isFinite(n) && n >= 10 && n <= 3600) out.daySeconds = n;
  }
  out.debug = p.get('debug') === '1';
  return out;
}

export function getFlags() {
  return parseFlags(typeof location !== 'undefined' ? location.search : '');
}
