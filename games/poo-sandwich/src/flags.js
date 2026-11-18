// Feature flags parsed from the URL query string (docs/FLAGS.md). Pure: no DOM access, main.js passes
// `location.search`. Unknown or invalid values fall back to the default. The parser comes from the kit (S-10,
// src/kit/flags.js); this file holds Poo Sandwich's schema. tests/flags-golden.test.js pins what every link gives.
import { createFlags, enumFlag, numberFlag, boolFlag } from './kit/flags.js';

const FLAGS = createFlags({
  controls: enumFlag('auto', ['auto', 'tap', 'joystick']),
  poo: enumFlag('hit', ['hit', 'choice']),
  dayLength: numberFlag(180, 10, 3600),
  debug: boolFlag(false),
}, {
  aliases: { daySeconds: 'dayLength' }, // the name before S-10: old links keep working
  exactEnums: true, // as before S-10: `controls=TAP` is ignored
  firstWins: true, // as before S-10: for a repeated name only the first occurrence counts
});

export const DEFAULT_FLAGS = FLAGS.DEFAULTS;
export const parseFlags = FLAGS.parseFlags;
