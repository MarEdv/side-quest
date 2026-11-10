// Retires the service worker Side Quest installed at the site root before it moved to games/side-quest/ (see
// docs/DECISIONS.md D-2). Based on games/side-quest/tools/sw-kill.js. Nothing registers this file: browsers that still
// have the old /side-quest/sw.js registration fetch it on their next visit, and it takes over and unregisters itself.
// It only drops cache entries outside games/, because the relocated game's worker uses the same cache names.
// No fetch handler, no reloads (see sw-kill.js). Keep it deployed: players who come back late still need it.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const gamesPrefix = new URL('games/', self.registration.scope).href;
    for (const name of await caches.keys()) {
      if (!name.startsWith('sidequest-')) continue;
      const cache = await caches.open(name);
      const stale = (await cache.keys()).filter((req) => !req.url.startsWith(gamesPrefix));
      await Promise.all(stale.map((req) => cache.delete(req)));
      if (!(await cache.keys()).length) await caches.delete(name);
    }
    await self.registration.unregister();
  })());
});
