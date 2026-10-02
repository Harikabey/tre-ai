import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "@/lib/notification-manager";

// Add manifest link dynamically (keeps index.html clean)
if (!document.querySelector('link[rel="manifest"]')) {
  const link = document.createElement("link");
  link.rel = "manifest";
  link.href = "/manifest.webmanifest";
  document.head.appendChild(link);
}

createRoot(document.getElementById("root")!).render(<App />);
void registerServiceWorker();
