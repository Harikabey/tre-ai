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

// Service worker registration is handled by usePushNotifications hook
// on user opt-in. We do NOT auto-register here to avoid iframe/preview issues.

createRoot(document.getElementById("root")!).render(<App />);
