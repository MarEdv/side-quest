// EMERGENCY KILL SWITCH for the service worker (D-26). Not used by the game; kept ready to deploy.
// Rollback: copy this file over sw.js (same name and path - browsers only check the registered URL for updates; deleting
// sw.js does NOT remove an installed worker, a 404 just keeps the old one) and, in the same commit, delete the
// registerServiceWorker() call in src/main.js. Deploy. Every player's browser fetches sw.js on its next visit (it skips the
// HTTP cache for it), this worker takes over, deletes the game's caches and unregisters itself; from then on the site is
// a plain web page again. It deliberately has no fetch handler and does not reload open tabs: a reload while an old page
// still registers sw.js would loop. Leave it deployed for a few weeks (players who come back late still need it).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('sidequest-')).map((k) => caches.delete(k)));
    await self.registration.unregister();
  })());
});
