// Service worker behaviour (sw.js and the tools/sw-kill.js rollback worker) run in Node against fake caches / fetch (D-26).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import vm from 'node:vm';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const BASE = 'https://maredv.github.io/side-quest/';

// A worker global with fake Cache Storage and network. net(url) returns a Response or throws (offline).
function load(file, net = () => { throw new TypeError('offline'); }) {
  const handlers = {};
  const stores = new Map(); // cache name -> Map(url -> Response)
  const urlOf = (k) => new URL(typeof k === 'string' ? k : k.url, BASE).href;
  const open = async (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      put: async (k, res) => { m.delete(urlOf(k)); m.set(urlOf(k), res); },
      match: async (k) => { const r = m.get(urlOf(k)); return r ? r.clone() : undefined; },
      addAll: async (reqs) => {
        const got = [];
        for (const r of reqs) { const res = await net(urlOf(r)); if (!res.ok) throw new TypeError('bad status'); got.push([urlOf(r), res]); }
        for (const [u, res] of got) m.set(u, res); // atomic: all or nothing
      },
      keys: async () => [...m.keys()],
    };
  };
  const calls = { skipWaiting: 0, claim: 0, unregister: 0, fetched: [] };
  const self = {
    location: new URL(BASE + 'sw.js'),
    addEventListener: (t, f) => { handlers[t] = f; },
    skipWaiting: async () => { calls.skipWaiting++; },
    clients: { claim: async () => { calls.claim++; } },
    registration: { unregister: async () => { calls.unregister++; return true; } },
  };
  const caches = { open, keys: async () => [...stores.keys()], delete: async (n) => stores.delete(n) };
  const fetch = async (req, init) => { calls.fetched.push([urlOf(req), init && init.cache]); return net(urlOf(req)); };
  // Request resolves relative URLs against the worker's location, as in a browser.
  const WRequest = function (u, init) { return new Request(new URL(typeof u === 'string' ? u : u.url, BASE), init); };
  vm.runInNewContext(readFileSync(join(root, file), 'utf8'), { self, caches, fetch, Request: WRequest, Response, Headers, URL, console });
  // Dispatch a fetch event; returns the response (or undefined if the worker did not call respondWith) after waitUntil settles.
  const request = async (url, { method = 'GET', mode = 'cors' } = {}) => {
    let responded = null; const waits = [];
    handlers.fetch({ request: { url: new URL(url, BASE).href, method, mode }, respondWith: (p) => { responded = p; }, waitUntil: (p) => waits.push(p) });
    if (!responded) return undefined;
    const res = await responded;
    await Promise.all(waits);
    return res;
  };
  const lifecycle = async (type) => { let p; handlers[type]({ waitUntil: (x) => { p = x; } }); return p; };
  return { handlers, stores, calls, request, lifecycle, open };
}
// Node's Response has type 'default'; a same-origin browser response is 'basic' (and so are its clones).
const basic = (r) => {
  const clone = r.clone.bind(r);
  return Object.defineProperties(r, { type: { value: 'basic' }, clone: { value: () => basic(clone()) } });
};
const ok = (body, init = {}) => basic(new Response(body, { status: 200, headers: { 'Cache-Control': 'max-age=600' }, ...init }));
const cached = async (w, url) => { const m = w.stores.get('sidequest-v1'); return m && m.get(new URL(url, BASE).href); };

test('sw: online = network (revalidated), good answers are cached, the page copy says no-cache', async () => {
  const w = load('sw.js', () => ok('v2'));
  const res = await w.request('src/game.js');
  assert.equal(await res.text(), 'v2');
  assert.equal(res.headers.get('cache-control'), 'no-cache'); // so the memory cache cannot skip the worker on reload
  assert.deepEqual(w.calls.fetched[0], [BASE + 'src/game.js', 'no-cache']);
  assert.equal(await (await cached(w, 'src/game.js')).text(), 'v2');
});

test('sw: 404 / 500 are passed through and never cached; opaque responses are not cached', async () => {
  for (const status of [404, 500]) {
    const w = load('sw.js', () => basic(new Response('err', { status })));
    assert.equal((await w.request('src/x.js')).status, status);
    assert.equal(await cached(w, 'src/x.js'), undefined);
  }
  const opaque = { ok: false, status: 0, type: 'opaque', redirected: false, clone() { return this; } };
  const w = load('sw.js', () => opaque);
  assert.equal(await w.request('src/x.js'), opaque);
  assert.equal(await cached(w, 'src/x.js'), undefined);
});

test('sw: non-GET and cross-origin requests are not intercepted', async () => {
  const w = load('sw.js', () => ok('x'));
  assert.equal(await w.request('index.html', { method: 'POST' }), undefined);
  assert.equal(await w.request('https://example.com/a.js'), undefined);
  assert.equal(w.calls.fetched.length, 0);
});

test('sw: offline, a page load with a query gets the newest index; subresources match exactly', async () => {
  let online = true;
  const w = load('sw.js', (u) => { if (!online) throw new TypeError('offline'); return ok(`${new URL(u).pathname}${new URL(u).search} @new`); });
  await w.request(BASE + '?wifeMode=random', { mode: 'navigate' }); // stored under ./ (no query)
  assert.ok(await cached(w, './'));
  assert.equal(await cached(w, BASE + '?wifeMode=random'), undefined);
  await w.request('src/ui.js?x=1'); // an odd variant must not shadow the real file offline
  await w.request('src/ui.js');
  online = false;
  assert.equal(await (await w.request(BASE + '?seed=5', { mode: 'navigate' })).text(), '/side-quest/?wifeMode=random @new'); // the newest page load, whatever its query
  assert.equal(await (await w.request('src/ui.js')).text(), '/side-quest/src/ui.js @new');
  assert.equal(await (await w.request('src/ui.js')).headers.get('cache-control'), 'no-cache');
  await assert.rejects(w.request('src/never-seen.js')); // nothing cached: a normal network error
});

test('sw: offline navigation to a page never cached falls back to the precached index', async () => {
  const w = load('sw.js');
  const c = await w.open('sidequest-v1');
  await c.put('index.html', ok('index'));
  assert.equal(await (await w.request(BASE + 'index.html?wifeMode=random', { mode: 'navigate' })).text(), 'index');
});

test('sw: install precaches atomically; a failed precache rejects install (no skipWaiting), old worker keeps running', async () => {
  const good = load('sw.js', () => ok('x'));
  await good.lifecycle('install');
  assert.equal(good.calls.skipWaiting, 1);
  assert.ok(await cached(good, 'src/main.js'));
  const bad = load('sw.js', (u) => (u.endsWith('wife.js') ? basic(new Response('', { status: 404 })) : ok('x')));
  await assert.rejects(bad.lifecycle('install'));
  assert.equal(bad.calls.skipWaiting, 0);
  assert.equal(await cached(bad, 'src/main.js'), undefined);
});

test('sw: activate deletes other sidequest-* caches only, then claims', async () => {
  const w = load('sw.js');
  await w.open('sidequest-v0'); await w.open('sidequest-v1'); await w.open('other-app');
  await w.lifecycle('activate');
  assert.deepEqual([...w.stores.keys()].sort(), ['other-app', 'sidequest-v1']);
  assert.equal(w.calls.claim, 1);
});

test('tools/sw-kill.js: no fetch handler, deletes our caches, unregisters, never reloads pages', async () => {
  const src = readFileSync(join(root, 'tools/sw-kill.js'), 'utf8');
  assert.ok(!/navigate\(|location\.reload/.test(src.replace(/\/\/.*$/gm, '')), 'a reload could loop while pages still register sw.js');
  const w = load('tools/sw-kill.js');
  assert.equal(w.handlers.fetch, undefined);
  await w.open('sidequest-v1'); await w.open('other-app');
  w.handlers.install({});
  await w.lifecycle('activate');
  assert.deepEqual([...w.stores.keys()], ['other-app']);
  assert.equal(w.calls.unregister, 1);
});
