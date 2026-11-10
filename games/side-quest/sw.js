// Retires the worker Garden Day registered here while it was still called Side Quest (root docs/DECISIONS.md D-5).
// Nothing registers this file: browsers with the old games/side-quest/sw.js registration fetch it on their next visit.
// It drops only cache entries under this folder (Garden Day's worker uses the same cache names), then unregisters.
// No fetch handler, no reloads (see games/garden-day/tools/sw-kill.js). Keep it deployed.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const scope = self.registration.scope;
    for (const name of await caches.keys()) {
      if (!name.startsWith('sidequest-')) continue;
      const cache = await caches.open(name);
      const stale = (await cache.keys()).filter((req) => req.url.startsWith(scope));
      await Promise.all(stale.map((req) => cache.delete(req)));
    }
    await self.registration.unregister();
  })());
});
