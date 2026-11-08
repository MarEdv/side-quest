// Feature flags. Pure module: no DOM/window access. main.js passes location.search to parseFlags.
export const DEFAULT_FLAGS = Object.freeze({
  wifeMode: 'vision',
  dayLength: 180,
  maxActiveQuests: 2,
  questInterval: 20,
  difficulty: 'normal',
  showVisionCone: true,
  wifeRoam: true,
  visionRange: 320,
  sound: true,
  seed: 'random',
  debug: false,
  touch: 'auto',
  touchScheme: 'joystick',
});

export const ENUMS = {
  wifeMode: ['vision', 'random'],
  difficulty: ['easy', 'normal', 'hard'],
  touch: ['auto', 'on', 'off'],
  touchScheme: ['joystick', 'tap'],
};

// [min, max] inclusive bounds for numeric flags; `int` flags must be whole numbers.
export const NUMBERS = {
  dayLength: { min: 10, max: 3600, int: false },
  maxActiveQuests: { min: 0, max: 5, int: true },
  questInterval: { min: 3, max: 300, int: false },
  visionRange: { min: 50, max: 1200, int: false },
};

export const BOOLS = ['showVisionCone', 'wifeRoam', 'sound', 'debug'];

export function parseBool(v) {
  const s = String(v).trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'on' || s === 'yes') return true;
  if (s === '0' || s === 'false' || s === 'off' || s === 'no') return false;
  return undefined;
}

// Validate one flag value (string from a URL, or a typed value from storage). Returns the clean value, or undefined
// when it is not acceptable. The single source of truth for URL parsing and for sanitising saved settings.
export function parseFlagValue(key, raw) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_FLAGS, key)) return undefined;
  if (typeof raw !== 'string' && typeof raw !== 'number' && typeof raw !== 'boolean') return undefined;
  const text = String(raw);
  if (ENUMS[key]) {
    const v = text.trim().toLowerCase();
    return ENUMS[key].includes(v) ? v : undefined;
  }
  if (NUMBERS[key]) {
    const { min, max, int } = NUMBERS[key];
    if (text.trim() === '') return undefined;
    const n = Number(text);
    return Number.isFinite(n) && n >= min && n <= max && (!int || Number.isInteger(n)) ? n : undefined;
  }
  if (BOOLS.includes(key)) return parseBool(text);
  if (key === 'seed') {
    const t = text.trim();
    if (t.toLowerCase() === 'random') return 'random';
    return t !== '' && Number.isInteger(Number(t)) ? Number(t) : undefined;
  }
  return undefined;
}

// Only the flags a query string sets to a valid value, e.g. {wifeMode: 'random'}. Later duplicates win; junk is dropped.
export function parseFlagEntries(queryString = '') {
  const out = {};
  for (const [key, raw] of new URLSearchParams(String(queryString || ''))) {
    const v = parseFlagValue(key, raw);
    if (v !== undefined) out[key] = v;
  }
  return out;
}

export function parseFlags(queryString = '') {
  return { ...DEFAULT_FLAGS, ...parseFlagEntries(queryString) };
}

// Short human-readable summary of the gameplay flags, stored with each high score, e.g. "vision·roam·normal".
// Roaming only exists in vision mode, so random mode reads "random·normal".
export function settingsSummary(flags = DEFAULT_FLAGS) {
  const parts = [flags.wifeMode];
  if (flags.wifeMode === 'vision') parts.push(flags.wifeRoam ? 'roam' : 'patio');
  parts.push(flags.difficulty);
  return parts.join('\u00b7');
}
