// Tre push service worker
// Handles incoming push notifications + inline reply (Android Chrome)

const SUPABASE_URL = "https://ukjfzpphxjssukbghxgg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVramZ6cHBoeGpzc3VrYmdoeGdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNDc0NzAsImV4cCI6MjA4MTcyMzQ3MH0.YZTpzGtBuIGQYpTvDO8soBWwE-I1e_zB9x6OfAFX9u8";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Read user JWT from IndexedDB (written by usePushNotifications hook)
async function getUserToken() {
  return new Promise((resolve) => {
    const req = indexedDB.open("tre-push", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("auth");
    req.onsuccess = () => {
      const db = req.result;
      try {
        const tx = db.transaction("auth", "readonly").objectStore("auth").get("jwt");
        tx.onsuccess = () => resolve(tx.result || null);
        tx.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    };
    req.onerror = () => resolve(null);
  });
}

self.addEventListener("push", (event) => {
  let payload = { title: "Tre", body: "Yeni mesaj", conversationId: null };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (e) {
    if (event.data) payload.body = event.data.text();
  }

  const options = {
    body: payload.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.conversationId ? `tre-${payload.conversationId}` : "tre",
    data: {
      conversationId: payload.conversationId,
      url: payload.url || "/",
    },
    actions: [
      { action: "reply", type: "text", title: "Cevap yaz", placeholder: "Tre'ye yaz..." },
      { action: "open", title: "Aç" },
    ],
    requireInteraction: true,
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(payload.title || "Tre", options));
});

self.addEventListener("notificationclick", (event) => {
  const notif = event.notification;
  const action = event.action;
  const replyText = event.reply; // Android Chrome inline reply text

  notif.close();

  if (action === "reply") {
    if (replyText && replyText.trim()) {
      event.waitUntil((async () => {
        const token = await getUserToken();
        if (!token) return self.clients.openWindow("/");
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/reply-to-tre`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
              "apikey": SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              conversationId: notif.data?.conversationId || null,
              message: replyText.trim(),
            }),
          });
        } catch (e) {
          console.error("[sw] reply failed", e);
        }
      })());
      return;
    }
    // Reply action tapped without text (browser doesn't support inline reply) → open app
    event.waitUntil(self.clients.openWindow(notif.data?.url || "/"));
    return;
  }

  // Plain click or "open" action → focus or open app
  const targetUrl = notif.data?.url || "/";
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of allClients) {
      if ("focus" in c) {
        await c.focus();
        if (c.url !== self.location.origin + targetUrl) {
          try { await c.navigate(targetUrl); } catch (e) {}
        }
        return;
      }
    }
    return self.clients.openWindow(targetUrl);
  })());
});
