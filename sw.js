// Service worker (D-25): network-first with cache fallback. Online, every request goes to the network (revalidated, never
// answered from the browser's HTTP cache), so a new deploy shows up on the next load; the successful response is copied
// into the cache. Offline, the cached copy is served (a page load with any query string gets the cached index). The app
// shell is precached at install so a first offline launch works. Rollback / kill switch: tools/sw-kill.js (D-26).
// Keep PRECACHE in step with the files: tests/pwa.test.js checks it against src/*.js, icons/ and the manifest.
const CACHE = 'sidequest-v1'; // bump only to force-drop every old entry; staleness is handled by network-first
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'src/audio.js',
  'src/chores.js',
  'src/config.js',
  'src/game.js',
  'src/geometry.js',
  'src/input.js',
  'src/install.js',
  'src/installmodel.js',
  'src/installui.js',
  'src/levels.js',
  'src/levelsui.js',
  'src/main.js',
  'src/quests.js',
  'src/render.js',
  'src/rng.js',
  'src/scores.js',
  'src/settings.js',
  'src/settingsui.js',
  'src/storage.js',
  'src/touch.js',
  'src/touchmath.js',
  'src/ui.js',
  'src/uimodel.js',
  'src/wife.js',
  'src/world.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('sidequest-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch third-party requests
  event.respondWith(networkFirst(req, event));
});

// The page gets a copy marked "Cache-Control: no-cache" (D-26). Otherwise the renderer's memory cache keeps GitHub
// Pages' max-age=600 copies of the modules and serves them on a reload in the same tab *without asking this worker*, so a
// deploy would not show (and index.html and the modules could mix versions) for up to 10 minutes. Only plain good
// same-origin responses are copied (a redirected one keeps its own URL, which relative module imports depend on).
function revalidating(res) {
  if (!res.ok || res.type !== 'basic' || res.redirected) return res;
  try {
    const headers = new Headers(res.headers);
    headers.set('Cache-Control', 'no-cache');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  } catch { return res; } // never fail a request over this
}

// Cache key: a page load is stored under its URL without the query, so "?wifeMode=random" and "./" share one, always the
// newest, copy of index.html. Everything else is matched exactly: an ignoreSearch lookup could return an older "?x"
// variant that the cache happens to list first (D-26).
const keyOf = (req) => {
  if (req.mode !== 'navigate') return req;
  const u = new URL(req.url);
  u.search = '';
  u.hash = '';
  return u.href;
};

async function networkFirst(req, event) {
  const key = keyOf(req);
  let res;
  try {
    res = await fetch(req, { cache: 'no-cache' }); // revalidate: GitHub Pages sends max-age=600
  } catch (err) {
    const cache = await caches.open(CACHE);
    const hit = (await cache.match(key)) || (req.mode === 'navigate' ? (await cache.match('./')) || (await cache.match('index.html')) : null);
    if (hit) return revalidating(hit);
    throw err;
  }
  // Only a good, same-origin, non-redirected answer is kept; errors (404/500), opaque and redirected responses pass through.
  if (res.ok && res.type === 'basic' && !res.redirected) {
    const copy = res.clone();
    event.waitUntil(caches.open(CACHE).then((c) => c.put(key, copy)).catch(() => {}));
  }
  return revalidating(res);
}
