// Feature flags parsed from the URL query string (docs/FLAGS.md). Pure: no DOM access, the caller passes
// `location.search`. Unknown or invalid values fall back to the default. The parser comes from the kit
// (src/kit/flags.js); this file holds Train Attendant's schema.
import { createFlags, enumFlag, boolFlag, customFlag } from './kit/flags.js';

export const CARS = Object.freeze([3, 2, 4]);

// `2`, `3`, `4` (any spelling Number() reads as one of them).
function parseCars(text) {
  const n = Number(text);
  return CARS.includes(n) ? n : undefined;
}

// Up to 10 digits (spaces around allowed), at most 0x7fffffff. Absent or invalid: null, a random trip.
function parseSeed(text) {
  const t = text.trim();
  if (!/^\d{1,10}$/.test(t)) return undefined;
  const n = Number(t);
  return n <= 0x7fffffff ? n : undefined;
}

const FLAGS = createFlags({
  trip: enumFlag('normal', ['short', 'normal', 'long']),
  cars: customFlag(3, parseCars),
  difficulty: enumFlag('normal', ['easy', 'normal', 'hard']),
  quests: enumFlag('offer', ['offer', 'assign']),
  stress: enumFlag('solo', ['solo', 'contagious']),
  seed: customFlag(null, parseSeed),
  touch: enumFlag('auto', ['auto', 'on', 'off']),
  sound: boolFlag(true),
  debug: boolFlag(false),
});

export const DEFAULT_FLAGS = FLAGS.DEFAULTS;
export const parseFlags = FLAGS.parseFlags;
