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

const ENUMS = {
  wifeMode: ['vision', 'random'],
  difficulty: ['easy', 'normal', 'hard'],
  touch: ['auto', 'on', 'off'],
  touchScheme: ['joystick', 'tap'],
};

// [min, max] inclusive bounds for numeric flags; `int` flags must be whole numbers.
const NUMBERS = {
  dayLength: { min: 10, max: 3600, int: false },
  maxActiveQuests: { min: 0, max: 5, int: true },
  questInterval: { min: 3, max: 300, int: false },
  visionRange: { min: 50, max: 1200, int: false },
};

const BOOLS = ['showVisionCone', 'wifeRoam', 'sound', 'debug'];

export function parseBool(v) {
  const s = String(v).trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'on' || s === 'yes') return true;
  if (s === '0' || s === 'false' || s === 'off' || s === 'no') return false;
  return undefined;
}

export function parseFlags(queryString = '') {
  const flags = { ...DEFAULT_FLAGS };
  const params = new URLSearchParams(String(queryString || ''));
  for (const [key, raw] of params) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_FLAGS, key)) continue; // unknown flags ignored
    if (ENUMS[key]) {
      const v = raw.trim().toLowerCase();
      if (ENUMS[key].includes(v)) flags[key] = v;
    } else if (NUMBERS[key]) {
      const { min, max, int } = NUMBERS[key];
      if (raw.trim() === '') continue;
      const n = Number(raw);
      if (Number.isFinite(n) && n >= min && n <= max && (!int || Number.isInteger(n))) flags[key] = n;
    } else if (BOOLS.includes(key)) {
      const b = parseBool(raw);
      if (b !== undefined) flags[key] = b;
    } else if (key === 'seed') {
      const t = raw.trim();
      if (t.toLowerCase() === 'random') flags.seed = 'random';
      else if (t !== '' && Number.isInteger(Number(t))) flags.seed = Number(t);
    }
  }
  return flags;
}
