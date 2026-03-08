import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import VoiceChat from "./pages/VoiceChat";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Apply saved text scale on app load
const savedScale = localStorage.getItem('ai_chatbot_text_scale');
if (savedScale) {
  document.documentElement.style.fontSize = `${parseFloat(savedScale) * 16}px`;
}
// Apply saved accessibility settings on app load
if (localStorage.getItem('ai_chatbot_high_contrast') === 'true') {
  document.documentElement.classList.add('high-contrast');
}
if (localStorage.getItem('ai_chatbot_reduce_motion') === 'true') {
  document.documentElement.classList.add('reduce-motion');
}

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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
