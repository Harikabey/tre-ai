import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VoiceChat from "./pages/VoiceChat";
import NotFound from "./pages/NotFound";
import "./hooks/useUICustomization"; // Apply UI customization on load (prevent FOUC)

const queryClient = new QueryClient();

// Apply saved preferences on app load (before React renders)
(() => {
  const root = document.documentElement;
  // Theme
  const savedTheme = localStorage.getItem('ai_chatbot_theme') || 'dark';
  let effectiveTheme: string;
  if (savedTheme === 'system') {
    effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } else {
    effectiveTheme = savedTheme;
  }
  root.classList.remove('light', 'dark');
  root.classList.add(effectiveTheme);
  // Text scale
  const savedScale = localStorage.getItem('ai_chatbot_text_scale');
  if (savedScale) {
    root.style.fontSize = `${parseFloat(savedScale) * 16}px`;
  }
  // Accessibility
  if (localStorage.getItem('ai_chatbot_high_contrast') === 'true') {
    root.classList.add('high-contrast');
  }
  if (localStorage.getItem('ai_chatbot_reduce_motion') === 'true') {
    root.classList.add('reduce-motion');
  }
})();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/voice-chat" element={<VoiceChat />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
