import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FLAGS, parseFlags } from '../src/config.js';
import { createStorage } from '../src/storage.js';
import {
  resolveFlags, sanitizeSaved, withSetting, splitFlags, GAMEPLAY_FLAGS, CONTROL_FLAGS, SETTING_ITEMS, inactiveReason,
  checkInput, createSettingsStore, changedKeys, overrideText,
} from '../src/settings.js';

const memBackend = () => { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) }; };

test('resolveFlags: nothing set gives defaults, all sourced "default"', () => {
  const r = resolveFlags(DEFAULT_FLAGS, {}, '');
  assert.deepEqual(r.flags, { ...DEFAULT_FLAGS });
  assert.deepEqual(r.locked, {});
  assert.ok(Object.values(r.source).every((s) => s === 'default'));
});

test('resolveFlags: saved beats default, URL beats saved, and URL flags are locked', () => {
  const saved = { wifeMode: 'random', difficulty: 'hard', dayLength: 90 };
  const r = resolveFlags(DEFAULT_FLAGS, saved, '?wifeMode=vision&sound=0');
  assert.equal(r.flags.wifeMode, 'vision');
  assert.equal(r.flags.difficulty, 'hard');
  assert.equal(r.flags.dayLength, 90);
  assert.equal(r.flags.sound, false);
  assert.deepEqual(r.locked, { wifeMode: 'vision', sound: false });
  assert.equal(r.source.wifeMode, 'url');
  assert.equal(r.source.difficulty, 'saved');
  assert.equal(r.source.questInterval, 'default');
  assert.equal(overrideText('wifeMode', r.locked.wifeMode), '?wifeMode=vision');
});

test('resolveFlags: an invalid URL value neither applies nor locks, so the saved value stays', () => {
  const r = resolveFlags(DEFAULT_FLAGS, { dayLength: 60 }, '?dayLength=abc&bogus=1&wifeMode=nope');
  assert.equal(r.flags.dayLength, 60);
  assert.deepEqual(r.locked, {});
});

test('resolveFlags with no saved settings matches parseFlags on any query', () => {
  for (const q of ['', '?wifeMode=random&dayLength=120&debug=1&seed=7', 'touch=ON&touchScheme=Tap&visionRange=9999']) {
    assert.deepEqual(resolveFlags(DEFAULT_FLAGS, undefined, q).flags, parseFlags(q));
  }
});

test('sanitizeSaved drops bad values with the same rules as URL parsing', () => {
  const bad = {
    wifeMode: 'chaos', difficulty: 'HARD', dayLength: 5, maxActiveQuests: 1.5, questInterval: '20', visionRange: 99999,
    sound: 'maybe', wifeRoam: false, debug: 2, seed: 'x', touch: ['on'], touchScheme: {}, showVisionCone: null, bogus: 1,
  };
  const c = sanitizeSaved({ v: 1, flags: bad });
  assert.deepEqual(c, { difficulty: 'hard', questInterval: 20, wifeRoam: false });
  assert.deepEqual(sanitizeSaved({ dayLength: 1e9, seed: 12 }), { seed: 12 });
});

test('sanitizeSaved copes with junk containers', () => {
  for (const junk of [null, undefined, 5, 'str', [], [1, 2], { flags: 'x' }, { flags: null }]) {
    assert.deepEqual(sanitizeSaved(junk), {});
  }
  assert.equal(Object.prototype.hasOwnProperty.call(sanitizeSaved({ __proto__: { sound: false } }), 'sound'), false);
});

test('gameplay vs control split covers every flag exactly once', () => {
  const all = Object.keys(DEFAULT_FLAGS).sort();
  assert.deepEqual([...GAMEPLAY_FLAGS, ...CONTROL_FLAGS].sort(), all);
  const { gameplay, control } = splitFlags({ ...DEFAULT_FLAGS, sound: false, wifeMode: 'random' });
  assert.deepEqual(Object.keys(control).sort(), ['debug', 'showVisionCone', 'sound', 'touch', 'touchScheme']);
  assert.equal(gameplay.wifeMode, 'random');
  assert.equal(control.sound, false);
  assert.equal('sound' in gameplay, false);
  assert.deepEqual(changedKeys(DEFAULT_FLAGS, { ...DEFAULT_FLAGS, sound: false, seed: 4 }), ['sound', 'seed']);
});

test('every flag has exactly one settings control', () => {
  assert.deepEqual(SETTING_ITEMS.map((i) => i.key).sort(), Object.keys(DEFAULT_FLAGS).sort());
  for (const i of SETTING_ITEMS) assert.ok(i.help.length > 10 && i.label);
});

test('inactive options are explained, not hidden', () => {
  assert.equal(inactiveReason('wifeRoam', { wifeMode: 'random' }), 'Only in vision mode');
  assert.equal(inactiveReason('visionRange', { wifeMode: 'random' }), 'Only in vision mode');
  assert.equal(inactiveReason('wifeRoam', { wifeMode: 'vision' }), null);
  assert.ok(inactiveReason('touchScheme', { touch: 'off' }));
  assert.equal(inactiveReason('touchScheme', { touch: 'auto' }), null);
  assert.equal(inactiveReason('difficulty', { wifeMode: 'random' }), null);
});

test('withSetting: valid changes are kept, defaults forgotten, invalid ignored', () => {
  let s = withSetting({}, 'wifeMode', 'random');
  s = withSetting(s, 'dayLength', '120');
  assert.deepEqual(s, { wifeMode: 'random', dayLength: 120 });
  assert.deepEqual(withSetting(s, 'dayLength', 500000), s);
  assert.deepEqual(withSetting(s, 'wifeMode', 'vision'), { dayLength: 120 });
  assert.deepEqual(withSetting(s, 'nope', 1), s);
});

test('checkInput gives clamps in the message', () => {
  assert.deepEqual(checkInput('dayLength', '90'), { ok: true, value: 90, error: '' });
  assert.match(checkInput('dayLength', '5').error, /10 to 3600/);
  assert.match(checkInput('maxActiveQuests', '1.5').error, /whole number from 0 to 5/);
  assert.equal(checkInput('seed', 'random').value, 'random');
  assert.equal(checkInput('seed', ' 42 ').value, 42);
  assert.equal(checkInput('seed', 'abc').ok, false);
});

test('storage round trip under sidequest.v1.settings, then reset', () => {
  const b = memBackend();
  const store = createSettingsStore(createStorage(b));
  assert.deepEqual(store.load(), {});
  assert.equal(store.save({ wifeMode: 'random', difficulty: 'hard', junk: 1, dayLength: 1 }), true);
  assert.deepEqual(JSON.parse(b.m.get('sidequest.v1.settings')), { v: 1, flags: { wifeMode: 'random', difficulty: 'hard' } });
  const again = createSettingsStore(createStorage(b)); // fresh session
  const r = resolveFlags(DEFAULT_FLAGS, again.load(), '?difficulty=easy');
  assert.equal(r.flags.wifeMode, 'random');
  assert.equal(r.flags.difficulty, 'easy');
  assert.deepEqual(again.reset(), {});
  assert.equal(b.m.has('sidequest.v1.settings'), false);
  assert.deepEqual(resolveFlags(DEFAULT_FLAGS, again.load(), '').flags, { ...DEFAULT_FLAGS });
});

test('corrupt stored settings load as empty', () => {
  const b = memBackend();
  b.m.set('sidequest.v1.settings', '{not json');
  assert.deepEqual(createSettingsStore(createStorage(b)).load(), {});
  b.m.set('sidequest.v1.settings', JSON.stringify({ v: 1, flags: { wifeMode: 'zzz', sound: false } }));
  assert.deepEqual(createSettingsStore(createStorage(b)).load(), { sound: false });
});

test('each control kind matches its flag type, and every flag is documented in FLAGS.md (D-24)', async () => {
  const { ENUMS, NUMBERS, BOOLS } = await import('../src/config.js');
  const { readFileSync } = await import('node:fs');
  for (const i of SETTING_ITEMS) {
    const want = ENUMS[i.key] ? 'select' : NUMBERS[i.key] ? 'number' : BOOLS.includes(i.key) ? 'toggle' : i.key === 'seed' ? 'seed' : '?';
    assert.equal(i.kind, want, i.key);
    if (i.kind === 'select') assert.deepEqual(Object.keys(i.options).sort(), [...ENUMS[i.key]].sort(), i.key);
  }
  const doc = readFileSync(new URL('../docs/FLAGS.md', import.meta.url), 'utf8');
  const rows = [...doc.matchAll(/^\| `(\w+)` \|/gm)].map((m) => m[1]).sort();
  assert.deepEqual(rows, Object.keys(DEFAULT_FLAGS).sort());
});

test('seed round-trips: a number survives save/load and shows back as text, "random" is forgotten (D-24)', () => {
  const b = memBackend();
  const store = createSettingsStore(createStorage(b));
  let saved = withSetting({}, 'seed', checkInput('seed', '42').value);
  store.save(saved);
  const loaded = createSettingsStore(createStorage(b)).load();
  assert.deepEqual(loaded, { seed: 42 });
  assert.equal(checkInput('seed', String(resolveFlags(DEFAULT_FLAGS, loaded, '').flags.seed)).value, 42);
  saved = withSetting(loaded, 'seed', checkInput('seed', 'random').value);
  assert.deepEqual(saved, {});
  assert.equal(resolveFlags(DEFAULT_FLAGS, { seed: -7 }, '?seed=random').flags.seed, 'random');
  assert.equal(resolveFlags(DEFAULT_FLAGS, { seed: 'random' }, '?seed=9').flags.seed, 9);
});
