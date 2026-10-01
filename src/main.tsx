import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Add manifest link dynamically (keeps index.html clean)
if (!document.querySelector('link[rel="manifest"]')) {
  const link = document.createElement("link");
  link.rel = "manifest";
  link.href = "/manifest.webmanifest";
  document.head.appendChild(link);
}

if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
    await Promise.all(registrations.map(async (registration) => {
      try {
        const subscription = await registration.pushManager.getSubscription();
        await subscription?.unsubscribe();
      } catch {
        // Continue unregistering even if the push subscription is unavailable.
      }
      await registration.unregister();
    }));
  }).catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
