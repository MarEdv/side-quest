// Feature flags. Pure module: no DOM/window access. main.js passes location.search to parseFlags. The parser comes from
// the kit (S-10, src/kit/flags.js); this file holds Garden Day's schema. docs/FLAGS.md lists every flag.
import { createFlags, enumFlag, numberFlag, boolFlag, customFlag } from './kit/flags.js';

export { parseBool } from './kit/flags.js';

// 'random', or an integer.
function parseSeed(text) {
  const t = text.trim();
  if (t.toLowerCase() === 'random') return 'random';
  return t !== '' && Number.isInteger(Number(t)) ? Number(t) : undefined;
}

// Schema order is the order of DEFAULT_FLAGS. Numbers are [min, max] inclusive; `int` flags must be whole numbers.
const FLAGS = createFlags({
  wifeMode: enumFlag('vision', ['vision', 'random', 'hybrid']),
  dayLength: numberFlag(180, 10, 3600),
  maxActiveQuests: numberFlag(2, 0, 5, true),
  questInterval: numberFlag(20, 3, 300),
  difficulty: enumFlag('normal', ['easy', 'normal', 'hard']),
  showVisionCone: boolFlag(true),
  wifeRoam: boolFlag(true),
  visionRange: numberFlag(320, 50, 1200),
  sound: boolFlag(true),
  seed: customFlag('random', parseSeed),
  debug: boolFlag(false),
  touch: enumFlag('auto', ['auto', 'on', 'off']),
  touchScheme: enumFlag('joystick', ['joystick', 'tap']),
});

export const DEFAULT_FLAGS = FLAGS.DEFAULTS;
export const ENUMS = FLAGS.ENUMS; // { wifeMode: [...], difficulty: [...], touch: [...], touchScheme: [...] }
export const NUMBERS = FLAGS.NUMBERS; // { dayLength: { min, max, int }, ... }
export const BOOLS = FLAGS.BOOLS; // ['showVisionCone', 'wifeRoam', 'sound', 'debug']

// Validate one flag value (string from a URL, or a typed value from storage). Returns the clean value, or undefined
// when it is not acceptable. The single source of truth for URL parsing and for sanitising saved settings.
export const parseFlagValue = FLAGS.parseFlagValue;

// Only the flags a query string sets to a valid value, e.g. {wifeMode: 'random'}. Later duplicates win; junk is dropped.
export const parseFlagEntries = FLAGS.parseFlagEntries;

export const parseFlags = FLAGS.parseFlags;

// Short human-readable summary of the gameplay flags, stored with each high score, e.g. "vision·roam·normal".
// Roaming only exists in vision and hybrid mode (hybrid always roams), so random mode reads "random·normal".
export function settingsSummary(flags = DEFAULT_FLAGS) {
  const parts = [flags.wifeMode];
  if (flags.wifeMode === 'vision') parts.push(flags.wifeRoam ? 'roam' : 'patio'); // hybrid always roams: nothing to add
  parts.push(flags.difficulty);
  return parts.join('\u00b7');
}
