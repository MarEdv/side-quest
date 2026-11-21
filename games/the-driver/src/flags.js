// Feature flags parsed from the URL query string (docs/FLAGS.md). Pure: no DOM access, the caller passes
// `location.search`. Unknown or invalid values fall back to the default. The parser comes from the kit
// (src/kit/flags.js); this file holds The Driver's schema.
import { createFlags, enumFlag, boolFlag, customFlag } from './kit/flags.js';

// Up to 10 digits (spaces around allowed), at most 0x7fffffff. Absent or invalid: null, a random drive.
function parseSeed(text) {
  const t = text.trim();
  if (!/^\d{1,10}$/.test(t)) return undefined;
  const n = Number(t);
  return n <= 0x7fffffff ? n : undefined;
}

const FLAGS = createFlags({
  length: enumFlag('normal', ['normal', 'short']),
  road: enumFlag('highway', ['highway', 'country']),
  steer: enumFlag('free', ['free', 'lanes']),
  pedals: enumFlag('auto', ['auto', 'manual']),
  crash: enumFlag('soft', ['soft', 'hard']),
  view: enumFlag('cockpit', ['cockpit', 'hood']),
  difficulty: enumFlag('normal', ['easy', 'normal', 'hard']),
  seed: customFlag(null, parseSeed),
  touch: enumFlag('auto', ['auto', 'on', 'off']),
  sound: boolFlag(true),
  debug: boolFlag(false),
});

export const DEFAULT_FLAGS = FLAGS.DEFAULTS;
export const parseFlags = FLAGS.parseFlags;
