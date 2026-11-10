// The retire workers (root sw.js, games/side-quest/sw.js) unregister the old Side Quest workers without touching the
// cache entries of Garden Day, which uses the same cache names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { ROOT } from '../tools/build-registry.mjs';

const SITE = 'https://maredv.github.io/side-quest/';

function load(file, scope, initial) {
  const stores = new Map(Object.entries(initial).map(([name, urls]) => [name, new Set(urls)]));
  const handlers = {};
  const calls = { skipWaiting: 0, unregister: 0 };
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (n) => stores.delete(n),
    open: async (n) => {
      const s = stores.get(n);
      return { keys: async () => [...s].map((url) => ({ url })), delete: async (req) => s.delete(req.url) };
    },
  };
  const self = {
    addEventListener: (t, f) => { handlers[t] = f; },
    skipWaiting: async () => { calls.skipWaiting++; },
    registration: { scope, unregister: async () => { calls.unregister++; return true; } },
  };
  vm.runInNewContext(readFileSync(join(ROOT, file), 'utf8'), { self, caches, URL });
  const lifecycle = async (type) => { let p; handlers[type]({ waitUntil: (x) => { p = x; } }); return p; };
  const contents = () => Object.fromEntries([...stores].map(([n, s]) => [n, [...s]]));
  return { calls, handlers, lifecycle, contents };
}

const GD = SITE + 'games/garden-day/index.html';
const OLD_GAME = SITE + 'games/side-quest/index.html';

test('root sw.js drops root cache entries only, keeps games/ entries, other apps and every cache, then unregisters', async () => {
  const w = load('sw.js', SITE, {
    'sidequest-v1': [SITE, SITE + 'index.html', SITE + 'src/main.js', GD],
    'sidequest-v0': [SITE + 'src/old.js'],
    'other-app': [SITE + 'x.js'],
  });
  await w.lifecycle('install');
  assert.equal(w.calls.skipWaiting, 1);
  await w.lifecycle('activate');
  assert.deepEqual(w.contents(), { 'sidequest-v1': [GD], 'sidequest-v0': [], 'other-app': [SITE + 'x.js'] });
  assert.equal(w.calls.unregister, 1);
  assert.equal(w.handlers.fetch, undefined, 'no fetch handler');
});

test('games/side-quest/sw.js drops only entries under its own folder, then unregisters', async () => {
  const w = load('games/side-quest/sw.js', SITE + 'games/side-quest/', {
    'sidequest-v1': [OLD_GAME, SITE + 'games/side-quest/src/main.js', GD, SITE + 'index.html'],
    'other-app': [SITE + 'games/side-quest/x.js'],
  });
  await w.lifecycle('install');
  await w.lifecycle('activate');
  assert.deepEqual(w.contents(), { 'sidequest-v1': [GD, SITE + 'index.html'], 'other-app': [SITE + 'games/side-quest/x.js'] });
  assert.equal(w.calls.unregister, 1);
  assert.equal(w.handlers.fetch, undefined, 'no fetch handler');
});
