// Retires the service worker Side Quest (now Garden Day) installed at the site root before it moved into games/ (see
// docs/DECISIONS.md D-2). Based on games/garden-day/tools/sw-kill.js. Nothing registers this file: browsers that still
// have the old /side-quest/sw.js registration fetch it on their next visit, and it takes over and unregisters itself.
// It only drops cache entries outside games/, because the relocated game's worker uses the same cache names (so it
// never deletes a whole cache, not even an emptied one: that could race with the game's worker filling it).
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
    }
    await self.registration.unregister();
  })());
});
