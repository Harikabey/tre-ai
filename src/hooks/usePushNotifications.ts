import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const JWT_DB = "tre-push";
const JWT_STORE = "auth";

function isPreviewOrIframe() {
  try {
    const inIframe = window.self !== window.top;
    const host = window.location.hostname;
    const isPreview =
      host.includes("id-preview--") ||
      host.includes("lovableproject.com") ||
      host === "localhost";
    return inIframe || isPreview;
  } catch {
    return true;
  }
}

async function saveJwt(jwt: string) {
  return new Promise<void>((resolve) => {
    const req = indexedDB.open(JWT_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(JWT_STORE);
    req.onsuccess = () => {
      const tx = req.result.transaction(JWT_STORE, "readwrite");
      tx.objectStore(JWT_STORE).put(jwt, "jwt");
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    };
    req.onerror = () => resolve();
  });
}

async function clearJwt() {
  return new Promise<void>((resolve) => {
    const req = indexedDB.open(JWT_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(JWT_STORE);
    req.onsuccess = () => {
      const tx = req.result.transaction(JWT_STORE, "readwrite");
      tx.objectStore(JWT_STORE).delete("jwt");
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    };
    req.onerror = () => resolve();
  });
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export interface PushState {
  supported: boolean;
  blockedInPreview: boolean;
  permission: NotificationPermission | "default";
  subscribed: boolean;
  loading: boolean;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>({
    supported: false,
    blockedInPreview: false,
    permission: "default",
    subscribed: false,
    loading: true,
  });

  const refresh = useCallback(async () => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    const blockedInPreview = isPreviewOrIframe();
    let subscribed = false;
    let permission: NotificationPermission = "default";

    if (supported) {
      permission = Notification.permission;
      if (!blockedInPreview) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            const sub = await reg.pushManager.getSubscription();
            subscribed = !!sub;
          }
        } catch (e) {
          console.warn("[push] state check failed", e);
        }
      }
    }

    setState({ supported, blockedInPreview, permission, subscribed, loading: false });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      if (isPreviewOrIframe()) {
        toast.error("Bildirimler yalnızca yayınlanmış sürümde çalışır", {
          description: "tre-ai.lovable.app adresinde tekrar dene.",
        });
        return false;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        toast.error("Tarayıcın bildirim desteklemiyor");
        return false;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Bildirim izni reddedildi");
        return false;
      }

      // Register SW
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Get public VAPID key
      const { data: keyData, error: keyErr } = await supabase.functions.invoke(
        "get-vapid-public-key",
        { body: {} },
      );
      if (keyErr || !keyData?.publicKey) {
        toast.error("VAPID anahtarı alınamadı");
        return false;
      }

      // Subscribe
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
        });
      }

      // Save JWT for SW
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.access_token) {
        await saveJwt(sessionData.session.access_token);
      }

      // Register subscription on server
      const subJson = sub.toJSON();
      const { error: regErr } = await supabase.functions.invoke("register-push-subscription", {
        body: {
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          userAgent: navigator.userAgent,
        },
      });
      if (regErr) {
        toast.error("Abonelik kaydedilemedi: " + regErr.message);
        return false;
      }

      toast.success("Bildirimler aktifleştirildi");
      await refresh();
      return true;
    } catch (e: any) {
      console.error("[push] subscribe failed", e);
      toast.error("Abone olunamadı: " + (e?.message || String(e)));
      return false;
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [refresh]);

  const unsubscribe = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
        }
      }
      await clearJwt();
      toast.success("Bildirimler kapatıldı");
      await refresh();
    } catch (e) {
      console.error("[push] unsubscribe failed", e);
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [refresh]);

  const sendTest = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: {
          title: "Tre",
          body: "Bu bir test bildirimi 👋 Cevap yazıp gönderebilirsin.",
        },
      });
      if (error) throw error;
      if ((data as any)?.sent === 0) {
        toast.warning("Aktif abonelik bulunamadı. Önce bildirimleri aç.");
      } else {
        toast.success("Test bildirimi gönderildi");
      }
    } catch (e: any) {
      toast.error("Test gönderilemedi: " + (e?.message || String(e)));
    }
  }, []);

  // Keep JWT fresh
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (session?.access_token && state.subscribed) {
        await saveJwt(session.access_token);
      }
    });
    return () => subscription.unsubscribe();
  }, [state.subscribed]);

  return { ...state, subscribe, unsubscribe, sendTest, refresh };
}
