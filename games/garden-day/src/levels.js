// The four levels (Features 4 & 5, L-1..L-6, D-27). Pure data and helpers, no DOM.
//
// A level fixes the *gameplay* flags (settings.js GAMEPLAY_FLAGS). Flags a level does not list use DEFAULT_FLAGS, never
// the player's saved settings or the URL, so a level plays the same for everyone. Control / display flags (CONTROL_FLAGS:
// touch, touchScheme, sound, showVisionCone, debug) still come from the player's resolved settings. `seed` is random
// unless `debug` is on (then the Settings / URL seed is used, so a debug run can be replayed).
import { DEFAULT_FLAGS, parseFlagValue } from './config.js';
import { GAMEPLAY_FLAGS, CONTROL_FLAGS, pick } from './settings.js';

export const LEVELS = Object.freeze([
  { id: 'l1', name: 'Saturday Morning',
    briefing: 'A quiet start: she only sees you from the patio, and one errand at a time.',
    flags: Object.freeze({ wifeMode: 'vision', wifeRoam: false, difficulty: 'easy', maxActiveQuests: 1, questInterval: 24, dayLength: 180, visionRange: 320 }) },
  { id: 'l2', name: 'Honey-Do List',
    briefing: 'New: she calls errands out wherever you are, so there is nowhere to hide. Two at a time.',
    flags: Object.freeze({ wifeMode: 'random', difficulty: 'normal', maxActiveQuests: 2, questInterval: 24, dayLength: 180 }) },
  { id: 'l3', name: 'Eyes Everywhere',
    briefing: 'New: she walks the garden and sees farther, and she comes out more often. Stay behind cover.',
    flags: Object.freeze({ wifeMode: 'vision', wifeRoam: true, difficulty: 'normal', maxActiveQuests: 2, questInterval: 11, visionRange: 600, dayLength: 180 }) },
  { id: 'l4', name: 'The Inspection',
    briefing: 'New: if she misses you she may call an errand anyway. She comes out often, hard, three at a time, a shorter day.',
    flags: Object.freeze({ wifeMode: 'hybrid', difficulty: 'hard', maxActiveQuests: 3, questInterval: 12, visionRange: 320, dayLength: 175 }) },
]);

export const levelIndex = (id) => LEVELS.findIndex((l) => l.id === id);
export const levelById = (id) => LEVELS.find((l) => l.id === id) || null;
export const nextLevel = (id) => { const i = levelIndex(id); return i >= 0 && i + 1 < LEVELS.length ? LEVELS[i + 1] : null; };

// The complete flag set for playing a level. `settings` = the player's resolved flags (URL > saved > default); only its
// control / display flags are used (and its seed, when debug is on). URL gameplay overrides therefore never reach a level.
export function levelFlags(level, settings = DEFAULT_FLAGS) {
  const base = { ...pick(DEFAULT_FLAGS, GAMEPLAY_FLAGS), ...level.flags };
  const control = { ...pick(DEFAULT_FLAGS, CONTROL_FLAGS), ...pick(settings, CONTROL_FLAGS) };
  return { ...DEFAULT_FLAGS, ...base, ...control, seed: control.debug && settings.seed !== undefined ? settings.seed : 'random' };
}

// Every flag a level lists must be a gameplay flag with a value parseFlagValue accepts (tests check this).
export function levelProblems(level) {
  const out = [];
  for (const [k, v] of Object.entries(level.flags)) {
    if (!GAMEPLAY_FLAGS.includes(k) || k === 'seed') out.push(`${level.id}: ${k} is not a level gameplay flag`);
    else if (parseFlagValue(k, v) !== v) out.push(`${level.id}: ${k}=${v} is not valid`);
  }
  return out;
}

// Progress is derived from the per-level records ({best, won}, scores.js): level 0 is always open, level N opens once
// level N-1 has been won. A debug run is never recorded, so it can never unlock anything.
export function isUnlocked(index, records = {}) {
  if (index <= 0) return true;
  if (index >= LEVELS.length) return false;
  const prev = records[LEVELS[index - 1].id];
  return !!(prev && prev.won === true);
}
export const unlockedCount = (records = {}) => LEVELS.filter((_, i) => isUnlocked(i, records)).length;
