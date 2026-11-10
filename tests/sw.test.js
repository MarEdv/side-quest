// The root sw.js retires the pre-move Side Quest worker without touching the relocated game's cache entries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { ROOT } from '../tools/build-registry.mjs';

const SCOPE = 'https://maredv.github.io/side-quest/';

function load(initial) {
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
    registration: { scope: SCOPE, unregister: async () => { calls.unregister++; return true; } },
  };
  vm.runInNewContext(readFileSync(join(ROOT, 'sw.js'), 'utf8'), { self, caches, URL });
  const lifecycle = async (type) => { let p; handlers[type]({ waitUntil: (x) => { p = x; } }); return p; };
  return { stores, calls, handlers, lifecycle };
}

test('root sw.js drops old root cache entries, keeps games/ entries and other apps, then unregisters', async () => {
  const w = load({
    'sidequest-v1': [SCOPE, SCOPE + 'index.html', SCOPE + 'src/main.js', SCOPE + 'games/side-quest/index.html'],
    'sidequest-v0': [SCOPE + 'src/old.js'],
    'other-app': [SCOPE + 'x.js'],
  });
  await w.lifecycle('install');
  assert.equal(w.calls.skipWaiting, 1);
  await w.lifecycle('activate');
  assert.deepEqual([...w.stores.keys()].sort(), ['other-app', 'sidequest-v1']);
  assert.deepEqual([...w.stores.get('sidequest-v1')], [SCOPE + 'games/side-quest/index.html']);
  assert.equal(w.calls.unregister, 1);
  assert.equal(w.handlers.fetch, undefined, 'no fetch handler');
});
