import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import DemoChat from "./pages/DemoChat";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VoiceChat from "./pages/VoiceChat";
import Capabilities from "./pages/Capabilities";
import Starred from "./pages/Starred";

import NotFound from "./pages/NotFound";
import ExtensionFeaturePreview from "./components/ExtensionFeaturePreview";
import ShareTargetFeaturePreview from "./components/ShareTargetFeaturePreview";
import FileHandlerFeaturePreview from "./components/FileHandlerFeaturePreview";
import WidgetPreview from "./components/WidgetPreview";
import ScreenAnalysisTrigger from "./components/ScreenAnalysisTrigger";
import LocalSchedulerRunner from "./components/LocalSchedulerRunner";
import "./hooks/useUICustomization"; // Apply UI customization on load (prevent FOUC)

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ScreenAnalysisTrigger />
      <LocalSchedulerRunner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/capabilities" element={<Capabilities />} />
          <Route path="/starred" element={<Starred />} />

          <Route path="/voice-chat" element={<VoiceChat />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/demo-chat" element={<DemoChat />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/extension" element={<ExtensionFeaturePreview />} />
          <Route path="/share-target" element={<ShareTargetFeaturePreview />} />
          <Route path="/widget-preview" element={<WidgetPreview />} />
          <Route path="/file-handler" element={<FileHandlerFeaturePreview />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
