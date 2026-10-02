// FILE: public/sw.js
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
const pendingReplyAcks = new Map();
const REPLY_SETTINGS_DB = "tre-notification-settings";

function readReplyEnabled() {
  return new Promise((resolve) => {
    const request = indexedDB.open(REPLY_SETTINGS_DB, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("preferences")) request.result.createObjectStore("preferences");
      if (!request.result.objectStoreNames.contains("pendingReplies")) request.result.createObjectStore("pendingReplies", { keyPath: "replyId" });
    };
    request.onerror = () => resolve(false);
    request.onsuccess = () => {
      const transaction = request.result.transaction("preferences", "readonly");
      const setting = transaction.objectStore("preferences").get("replyEnabled");
      setting.onsuccess = () => resolve(setting.result === true);
      setting.onerror = () => resolve(false);
    };
  });
}

function saveReplyEnabled(enabled) {
  return new Promise((resolve) => {
    const request = indexedDB.open(REPLY_SETTINGS_DB, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("preferences")) request.result.createObjectStore("preferences");
      if (!request.result.objectStoreNames.contains("pendingReplies")) request.result.createObjectStore("pendingReplies", { keyPath: "replyId" });
    };
    request.onerror = () => resolve();
    request.onsuccess = () => {
      const transaction = request.result.transaction("preferences", "readwrite");
      transaction.objectStore("preferences").put(enabled, "replyEnabled");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    };
  });
}

function savePendingReply(reply) {
  return new Promise((resolve) => {
    const request = indexedDB.open(REPLY_SETTINGS_DB, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("preferences")) request.result.createObjectStore("preferences");
      if (!request.result.objectStoreNames.contains("pendingReplies")) request.result.createObjectStore("pendingReplies", { keyPath: "replyId" });
    };
    request.onerror = () => resolve(false);
    request.onsuccess = () => {
      const transaction = request.result.transaction("pendingReplies", "readwrite");
      transaction.objectStore("pendingReplies").put(reply);
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
    };
  });
}

function readPendingReplies() {
  return new Promise((resolve) => {
    const request = indexedDB.open(REPLY_SETTINGS_DB, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("preferences")) request.result.createObjectStore("preferences");
      if (!request.result.objectStoreNames.contains("pendingReplies")) request.result.createObjectStore("pendingReplies", { keyPath: "replyId" });
    };
    request.onerror = () => resolve([]);
    request.onsuccess = () => {
      const transaction = request.result.transaction("pendingReplies", "readonly");
      const replies = transaction.objectStore("pendingReplies").getAll();
      replies.onsuccess = () => resolve(replies.result);
      replies.onerror = () => resolve([]);
    };
  });
}

function removePendingReply(replyId) {
  return new Promise((resolve) => {
    const request = indexedDB.open(REPLY_SETTINGS_DB, 2);
    request.onerror = () => resolve();
    request.onsuccess = () => {
      const transaction = request.result.transaction("pendingReplies", "readwrite");
      transaction.objectStore("pendingReplies").delete(replyId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    };
  });
}

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
  const payloadData = payload.data && typeof payload.data === "object" ? payload.data : {};
  const options = {
    body: typeof payload.body === "string" ? payload.body : "Yeni bir bildirimin var.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: {
      ...payloadData,
      url: payloadData.url || payload.url || "/",
      conversationId: payload.conversationId || payloadData.conversationId || null,
    },
    ...(payload.options && typeof payload.options === "object" ? payload.options : {}),
  };

  event.waitUntil(readReplyEnabled().then((replyEnabled) => {
    const supportsActions = typeof self.Notification?.maxActions === "number" && self.Notification.maxActions > 0;
    if (!replyEnabled || !supportsActions) return self.registration.showNotification(title, options);

    const existingActions = Array.isArray(options.actions) ? options.actions : [];
    const replyableOptions = {
      ...options,
      actions: [...existingActions, { action: "reply", title: "Yanıtla", type: "text" }]
        .slice(0, self.Notification.maxActions),
    };
    return self.registration.showNotification(title, replyableOptions).catch(() =>
      self.registration.showNotification(title, options),
    );
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action !== "reply" || typeof event.reply !== "string") {
    const notificationData = event.notification.data || {};
    const target = new URL(notificationData.url || "/", self.location.origin);
    if (notificationData.conversationId) target.searchParams.set("conversationId", notificationData.conversationId);
    const targetUrl = target.href;
    event.waitUntil(self.clients.openWindow(targetUrl));
    return;
  }

  event.waitUntil((async () => {
    const notificationData = event.notification.data || {};
    const reply = {
      replyId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: event.reply.trim().slice(0, 500),
      conversationId: typeof notificationData.conversationId === "string" ? notificationData.conversationId : null,
    };
    if (!reply.text || !(await savePendingReply(reply))) return;

    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const target = new URL("/", self.location.origin);
    if (reply.conversationId) target.searchParams.set("conversationId", reply.conversationId);
    const client = clients[0] || await self.clients.openWindow(target.href);
    if (!client) return;

    await new Promise((resolve) => {
      let attempts = 0;
      const deliver = () => {
        client.postMessage({ type: "notification-reply", ...reply });
        attempts += 1;
        if (attempts >= 30) {
          pendingReplyAcks.delete(reply.replyId);
          resolve();
          return;
        }
        setTimeout(deliver, 250);
      };
      pendingReplyAcks.set(reply.replyId, () => {
        void removePendingReply(reply.replyId);
        resolve();
      });
      deliver();
    });
  })());
});

self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || typeof message !== "object") return;

  if (message.type === "NOTIFICATION_REPLY_ACK" && typeof message.replyId === "string") {
    pendingReplyAcks.get(message.replyId)?.();
    pendingReplyAcks.delete(message.replyId);
    return;
  }

  if (message.type === "GET_PENDING_NOTIFICATION_REPLIES") {
    event.waitUntil(readPendingReplies().then((replies) => {
      event.source?.postMessage({ type: "PENDING_NOTIFICATION_REPLIES", replies });
    }));
    return;
  }

  if (message.type === "SET_REPLY_ENABLED" && typeof message.enabled === "boolean") {
    event.waitUntil(saveReplyEnabled(message.enabled));
    return;
  }

  if (message.type === "SHOW_REPLYABLE_NOTIFICATION") {
    const title = typeof message.title === "string" ? message.title : "Tre";
    const body = typeof message.body === "string" ? message.body : "";
    const options = message.options && typeof message.options === "object" ? message.options : {};
    const supportsActions = typeof self.Notification?.maxActions === "number" && self.Notification.maxActions > 0;
    const notificationOptions = {
      body,
      ...options,
      data: {
        ...(options.data && typeof options.data === "object" ? options.data : {}),
        url: "/",
        conversationId: typeof message.conversationId === "string" ? message.conversationId : null,
      },
    };
    const replyableOptions = {
      ...notificationOptions,
      actions: [{ action: "reply", title: "Yanıtla", type: "text" }],
    };
    event.waitUntil(supportsActions
      ? self.registration.showNotification(title, replyableOptions).catch(() =>
        self.registration.showNotification(title, notificationOptions),
      )
      : self.registration.showNotification(title, notificationOptions));
    return;
  }

  if (message.type !== "SHOW_NOTIFICATION") return;

  const title = typeof message.title === "string" ? message.title : "Tre";
  const body = typeof message.body === "string" ? message.body : "";
  const options = message.options && typeof message.options === "object" ? message.options : {};
  event.waitUntil(self.registration.showNotification(title, { body, ...options }));
});

self.addEventListener("notificationclose", (event) => {
  console.info("Tre bildirimi kapatıldı", event.notification.tag || "etiketsiz");
});