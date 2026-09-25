// Keeps the gate opener page on the phone so it still loads at a gate with no signal.
const CACHE = "open-gate-v1";
const PAGES = ["./", "./sw.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PAGES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function fromNetwork(request) {
  const timeout = new Promise((resolve, reject) => setTimeout(() => reject(new Error("slow")), 3000));
  return Promise.race([fetch(request), timeout]).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
    return response;
  });
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }
  event.respondWith(fromNetwork(event.request).catch(() => caches.match(event.request, { ignoreSearch: true })));
});
