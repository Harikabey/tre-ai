const CACHE_NAME = "tre-shell-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isApi = url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/rest/v1/") ||
    url.pathname.startsWith("/auth/v1/") ||
    url.pathname.startsWith("/functions/v1/") ||
    url.hostname.endsWith(".supabase.co");

  if (isApi) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match("/offline.html"));
        }),
    );
    return;
  }

  const isStatic = url.origin === self.location.origin &&
    /\.(?:avif|css|gif|ico|jpeg|jpg|js|png|svg|webmanifest|webp|woff2?)$/i.test(url.pathname);
  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
      ),
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() || "" };
  }

  const title = typeof payload.title === "string" ? payload.title : "Tre";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "Yeni bir bildirimin var.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: "/", ...(payload.data && typeof payload.data === "object" ? payload.data : {}) },
    ...(payload.options && typeof payload.options === "object" ? payload.options : {}),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/"));
});

self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || typeof message !== "object" || message.type !== "SHOW_NOTIFICATION") return;

  const title = typeof message.title === "string" ? message.title : "Tre";
  const body = typeof message.body === "string" ? message.body : "";
  const options = message.options && typeof message.options === "object" ? message.options : {};
  event.waitUntil(self.registration.showNotification(title, { body, ...options }));
});

self.addEventListener("notificationclose", (event) => {
  console.info("Tre bildirimi kapatıldı", event.notification.tag || "etiketsiz");
});