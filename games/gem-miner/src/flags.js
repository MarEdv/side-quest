// Feature flags parsed from the URL query string (docs/FLAGS.md). Pure: no DOM access, the caller passes
// `location.search`. Unknown or invalid values fall back to the default. The parser comes from the kit (S-10,
// src/kit/flags.js); this file holds Gem Miner's schema. tests/flags-golden.test.js pins what every link gives.
import { createFlags, enumFlag, boolFlag, customFlag } from './kit/flags.js';

export const WORLD_SIZES = Object.freeze([256, 128, 512]);

// Any spelling Number() reads as one of the sizes (`128`, `128.0`, ` 128 `).
function parseWorldSize(text) {
  const n = Number(text);
  return WORLD_SIZES.includes(n) ? n : undefined;
}

// Up to 10 digits (spaces around allowed), at most 0x7fffffff. Absent or invalid: null, a random world.
function parseSeed(text) {
  const t = text.trim();
  if (!/^\d{1,10}$/.test(t)) return undefined;
  const n = Number(t);
  return n <= 0x7fffffff ? n : undefined;
}

const FLAGS = createFlags({
  worldSize: customFlag(256, parseWorldSize),
  seed: customFlag(null, parseSeed),
  camera: enumFlag('deadzone', ['deadzone', 'center']),
  fog: boolFlag(true),
  durability: boolFlag(false),
  touch: enumFlag('auto', ['auto', 'on', 'off']),
  touchScheme: enumFlag('dpad', ['dpad', 'joystick']),
  sound: boolFlag(true),
  debug: boolFlag(false),
}, {
  aliases: { touchControls: 'touchScheme' }, // the name before S-10: old links keep working
  exactEnums: true, // as before S-10: `camera=CENTER` is ignored
  firstWins: true, // as before S-10: for a repeated name only the first occurrence counts
});

export const DEFAULT_FLAGS = FLAGS.DEFAULTS;
export const parseFlags = FLAGS.parseFlags;
