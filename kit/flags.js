// Pure: no DOM. Feature flags from a URL query string (S-10): a game declares a schema and gets its parser. The caller
// passes `location.search`. Every game pins what its links give with tests/flags-golden.test.js.
//
// A schema maps each flag name to { type, default, ... }:
//   { type: 'enum', default, values: [...] }           one of the values (trimmed and lower-cased first, unless exactEnums)
//   { type: 'number', default, min, max, int: bool }    a finite number in [min, max]; whole when `int`
//   { type: 'bool', default }                          parseBool's spellings
//   { type: 'custom', default, parse: (text) => v }     the game's own rule; return undefined to reject
//
// Options:
//   aliases: { oldName: 'newName' }  an old name is parsed as the new flag; a valid value under the new name wins
//   exactEnums: true                 enum values must match exactly (no trimming, no case folding)
//   firstWins: true                  for a repeated name only the first occurrence counts, even when it is invalid
//                                    (default: every valid occurrence is applied, so the last valid one wins)

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const TYPES = ['enum', 'number', 'bool', 'custom'];

// '1/true/on/yes' and '0/false/off/no', any case, surrounding spaces ignored. Anything else gives undefined.
export function parseBool(v) {
  const s = String(v).trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'on' || s === 'yes') return true;
  if (s === '0' || s === 'false' || s === 'off' || s === 'no') return false;
  return undefined;
}

// Shorthands for schema entries.
export const enumFlag = (dflt, values) => ({ type: 'enum', default: dflt, values });
export const numberFlag = (dflt, min, max, int = false) => ({ type: 'number', default: dflt, min, max, int });
export const boolFlag = (dflt) => ({ type: 'bool', default: dflt });
export const customFlag = (dflt, parse) => ({ type: 'custom', default: dflt, parse });

export function createFlags(schema, { aliases = {}, exactEnums = false, firstWins = false } = {}) {
  const defaults = {};
  const ENUMS = {};
  const NUMBERS = {};
  const BOOLS = [];
  for (const [key, spec] of Object.entries(schema)) {
    if (!spec || !TYPES.includes(spec.type)) throw new Error(`flag ${key}: unknown type ${spec && spec.type}`);
    if (!has(spec, 'default')) throw new Error(`flag ${key}: no default`);
    if (spec.type === 'enum') ENUMS[key] = [...spec.values];
    if (spec.type === 'number') NUMBERS[key] = { min: spec.min, max: spec.max, int: !!spec.int };
    if (spec.type === 'bool') BOOLS.push(key);
    if (spec.type === 'custom' && typeof spec.parse !== 'function') throw new Error(`flag ${key}: no parse function`);
    defaults[key] = spec.default;
  }
  for (const [from, to] of Object.entries(aliases)) {
    if (!has(schema, to) || has(schema, from)) throw new Error(`alias ${from} -> ${to}: must map an unused name to a flag`);
  }

  // Validate one flag value (a string from a URL, or a typed value from storage). Returns the clean value, or undefined
  // when it is not acceptable.
  function parseFlagValue(key, raw) {
    if (!has(schema, key)) return undefined;
    if (typeof raw !== 'string' && typeof raw !== 'number' && typeof raw !== 'boolean') return undefined;
    const text = String(raw);
    const spec = schema[key];
    if (spec.type === 'enum') {
      const v = exactEnums ? text : text.trim().toLowerCase();
      return ENUMS[key].includes(v) ? v : undefined;
    }
    if (spec.type === 'number') {
      const { min, max, int } = NUMBERS[key];
      if (text.trim() === '') return undefined;
      const n = Number(text);
      return Number.isFinite(n) && n >= min && n <= max && (!int || Number.isInteger(n)) ? n : undefined;
    }
    if (spec.type === 'bool') return parseBool(text);
    return spec.parse(text);
  }

  // Only the flags a query string sets to a valid value, e.g. {wifeMode: 'random'}. Junk and unknown names are dropped.
  function parseFlagEntries(queryString = '') {
    const direct = {};
    const viaAlias = {};
    const seen = new Set();
    for (const [name, raw] of new URLSearchParams(String(queryString || ''))) {
      if (firstWins) { if (seen.has(name)) continue; seen.add(name); }
      const alias = has(aliases, name);
      const key = alias ? aliases[name] : name;
      const v = parseFlagValue(key, raw);
      if (v !== undefined) (alias ? viaAlias : direct)[key] = v;
    }
    return { ...viaAlias, ...direct };
  }

  const DEFAULTS = Object.freeze(defaults);
  return {
    DEFAULTS, ENUMS, NUMBERS, BOOLS, parseFlagValue, parseFlagEntries,
    parseFlags: (queryString = '') => ({ ...DEFAULTS, ...parseFlagEntries(queryString) }),
  };
}
