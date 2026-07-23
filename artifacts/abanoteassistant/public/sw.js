/* Emergency service worker for stale Cloudflare-cached /sw.js clients.
 * Real PWA control lives at /sw-v3.js. This script only clears old caches and unregisters.
 */
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        if ("navigate" in client) {
          client.navigate(client.url);
        }
      }
    })(),
  );
});
