// Service worker (D-25): network-first with cache fallback. Online, every request goes to the network (revalidated, never
// answered from the browser's HTTP cache), so a new deploy shows up on the next load; the successful response is copied
// into the cache. Offline, the cached copy is served. The app shell is precached at install so a first offline launch works.
// Keep PRECACHE in step with the files: tests/install.test.js checks it against src/*.js, icons/ and the manifest.
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

async function networkFirst(req, event) {
  try {
    const res = await fetch(req, { cache: 'no-cache' }); // revalidate: GitHub Pages sends max-age=600
    if (res.ok && res.type === 'basic') {
      const copy = res.clone();
      event.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}));
    }
    return res;
  } catch (err) {
    const cache = await caches.open(CACHE);
    // ignoreSearch: "?wifeMode=random" links work offline too.
    const hit = (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await cache.match('index.html') : null);
    if (hit) return hit;
    throw err;
  }
}
