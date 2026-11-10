// Settings model (pure, no DOM): which flags the Settings screen edits, how URL / saved / default values combine,
// and the split between gameplay flags and control/display flags (Levels ignore the gameplay ones, src/levels.js, D-20/D-23/D-27).
import { DEFAULT_FLAGS, ENUMS, NUMBERS, parseFlagValue, parseFlagEntries } from './config.js';

export const SETTINGS_KEY = 'settings'; // stored as sidequest.v1.settings = { v: 1, flags: { ...only the player's choices } }

// Gameplay flags change how a day plays and apply when the next day starts. Levels override these.
export const GAMEPLAY_FLAGS = Object.freeze(['wifeMode', 'wifeRoam', 'difficulty', 'dayLength', 'maxActiveQuests', 'questInterval', 'visionRange', 'seed']);
// Control / display / sound / debug flags apply immediately and also hold inside Levels.
export const CONTROL_FLAGS = Object.freeze(['touch', 'touchScheme', 'showVisionCone', 'sound', 'debug']);

export const pick = (flags, keys) => Object.fromEntries(keys.filter((k) => k in flags).map((k) => [k, flags[k]]));
export const gameplayOf = (flags) => pick(flags, GAMEPLAY_FLAGS);
export const controlOf = (flags) => pick(flags, CONTROL_FLAGS);
export const splitFlags = (flags) => ({ gameplay: gameplayOf(flags), control: controlOf(flags) });
export const isGameplayFlag = (key) => GAMEPLAY_FLAGS.includes(key);
// Which keys differ between two flag sets.
export const changedKeys = (a, b) => Object.keys(DEFAULT_FLAGS).filter((k) => a[k] !== b[k]);

// Screen layout. kind: select | toggle | number | seed. Help text is the one-liner from docs/FLAGS.md.
export const SETTING_GROUPS = Object.freeze([
  { id: 'gameplay', title: 'Gameplay', note: 'Applies from the next day. Levels use their own gameplay settings.', items: [
    { key: 'wifeMode', label: 'Wife mode', kind: 'select', help: 'Vision: quests only when she sees you (avoidable). Random: quests on a timer wherever you are. Hybrid: she roams and looks for you, and if she misses you she may call a quest anyway.',
      options: { vision: 'Vision (avoidable)', random: 'Random (on a timer)', hybrid: 'Hybrid (looks, then may call)' } },
    { key: 'wifeRoam', label: 'Wife roams the garden', kind: 'toggle', help: 'Vision mode: she walks into the garden and sweeps the cone before going home. Off: she stays on the patio.' },
    { key: 'difficulty', label: 'Difficulty', kind: 'select', help: 'Easy: chores and quests take 0.75x as long, longer deadlines. Hard: 1.25x, shorter deadlines.',
      options: { easy: 'Easy', normal: 'Normal', hard: 'Hard' } },
    { key: 'dayLength', label: 'Day length (seconds)', kind: 'number', help: 'Real seconds from 09:00 to sunset at 18:00.' },
    { key: 'maxActiveQuests', label: 'Max side quests at once', kind: 'number', help: 'Cap on simultaneous side quests (0 = none).' },
    { key: 'questInterval', label: 'Quest interval (seconds)', kind: 'number', help: 'Mean seconds she stays inside between appearances.' },
    { key: 'visionRange', label: 'Vision range (px)', kind: 'number', help: 'How far she can see (cone length).' },
  ] },
  { id: 'controls', title: 'Controls', note: 'Applies immediately.', items: [
    { key: 'touch', label: 'Touch controls', kind: 'select', help: 'Auto: on touch devices and after the first touch. On: always. Off: never.',
      options: { auto: 'Auto', on: 'On', off: 'Off' } },
    { key: 'touchScheme', label: 'Touch scheme', kind: 'select', help: 'Joystick: floating stick plus a WORK button. Tap: tap or drag to walk, hold on a task to work.',
      options: { joystick: 'Joystick', tap: 'Tap to walk' } },
  ] },
  { id: 'display', title: 'Display & sound', note: 'Applies immediately.', items: [
    { key: 'showVisionCone', label: 'Show her vision cone', kind: 'toggle', help: 'Draw the wife\'s vision cone.' },
    { key: 'sound', label: 'Sound', kind: 'toggle', help: 'WebAudio blips.' },
  ] },
  { id: 'advanced', title: 'Advanced', note: 'Seed applies from the next day; debug immediately.', items: [
    { key: 'seed', label: 'Random seed', kind: 'seed', help: 'Type "random", or a whole number to replay the same day.' },
    { key: 'debug', label: 'Debug overlay', kind: 'toggle', help: 'Show hitboxes, FPS and state. Days played in debug are not recorded as high scores.' },
  ] },
]);

export const SETTING_ITEMS = Object.freeze(SETTING_GROUPS.flatMap((g) => g.items));

// Why an option does not matter right now (null = it matters). Shown as a note; the control is disabled, not hidden.
export function inactiveReason(key, flags) {
  if (key === 'wifeRoam' && flags.wifeMode === 'hybrid') return 'Hybrid mode always roams';
  if (key === 'wifeRoam' && flags.wifeMode !== 'vision') return 'Only in vision mode';
  if (key === 'visionRange' && flags.wifeMode === 'random') return 'Only in vision and hybrid mode';
  if (key === 'touchScheme' && flags.touch === 'off') return 'Only when touch controls are on';
  return null;
}

// Unwrap what storage returns ({v:1, flags:{...}} or a bare map) and keep only valid values of known flags.
export function sanitizeSaved(stored) {
  const src = stored && typeof stored === 'object' && !Array.isArray(stored) ? (stored.flags && typeof stored.flags === 'object' ? stored.flags : stored) : null;
  const out = {};
  if (!src || Array.isArray(src)) return out;
  for (const key of Object.keys(DEFAULT_FLAGS)) {
    if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
    const v = parseFlagValue(key, src[key]);
    if (v !== undefined) out[key] = v;
  }
  return out;
}

// Precedence: URL query > saved > default. Returns
//   flags  - the effective flags
//   source - per flag: 'url' | 'saved' | 'default'
//   locked - flags forced by a valid URL param -> the value (the screen shows them read-only)
//   saved  - the sanitised saved choices
export function resolveFlags(defaults = DEFAULT_FLAGS, saved = {}, urlQuery = '') {
  const clean = sanitizeSaved(saved);
  const url = parseFlagEntries(urlQuery);
  const flags = { ...defaults, ...clean, ...url };
  const source = {};
  for (const k of Object.keys(defaults)) source[k] = k in url ? 'url' : k in clean ? 'saved' : 'default';
  return { flags, source, locked: url, saved: clean };
}

// The link text shown for a locked flag, e.g. "?wifeMode=random".
export const overrideText = (key, value) => `?${key}=${value}`;

// New saved map with one choice changed. An invalid value changes nothing; a value equal to the default is
// forgotten (so a later change of the default reaches players who never customised it).
export function withSetting(saved, key, value, defaults = DEFAULT_FLAGS) {
  const clean = sanitizeSaved(saved);
  const v = parseFlagValue(key, value);
  if (v === undefined) return clean;
  if (v === defaults[key]) delete clean[key];
  else clean[key] = v;
  return clean;
}

// Validate text typed into a number / seed field. Returns {ok, value, error}.
export function checkInput(key, text) {
  const v = parseFlagValue(key, text);
  if (v !== undefined) return { ok: true, value: v, error: '' };
  if (key === 'seed') return { ok: false, value: undefined, error: 'Type "random" or a whole number.' };
  const spec = NUMBERS[key];
  if (spec) return { ok: false, value: undefined, error: `Enter ${spec.int ? 'a whole number' : 'a number'} from ${spec.min} to ${spec.max}.` };
  return { ok: false, value: undefined, error: 'Not a valid value.' };
}

export const enumValues = (key) => (ENUMS[key] ? [...ENUMS[key]] : []);
export const numberSpec = (key) => NUMBERS[key] || null;

// Persistence on top of a storage object (src/storage.js). The saved map only holds the player's choices.
export function createSettingsStore(storage) {
  return {
    load() { return sanitizeSaved(storage.get(SETTINGS_KEY)); },
    save(map) { return storage.set(SETTINGS_KEY, { v: 1, flags: sanitizeSaved(map) }); },
    reset() { storage.remove(SETTINGS_KEY); return {}; },
  };
}
