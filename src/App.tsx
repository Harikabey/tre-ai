// FILE: src/App.tsx
import { lazy, Suspense, useEffect } from "react";
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
import Stats from "./pages/Stats";
import Store from "./pages/TreStore";

import NotFound from "./pages/NotFound";
import ExtensionFeaturePreview from "./components/ExtensionFeaturePreview";
import ShareTargetFeaturePreview from "./components/ShareTargetFeaturePreview";
import FileHandlerFeaturePreview from "./components/FileHandlerFeaturePreview";
import WidgetPreview from "./components/WidgetPreview";
import ScreenAnalysisTrigger from "./components/ScreenAnalysisTrigger";
import LocalSchedulerRunner from "./components/LocalSchedulerRunner";
import { NotificationReplyListener } from "./components/NotificationReplyListener";
import { useNotifications } from "./hooks/useNotifications";
import { AvatarProvider } from "./hooks/useAvatar";
import { LanguageProvider } from "./contexts/LanguageContext";
import ProtectedRoute from "./components/ProtectedRoute";
import "./hooks/useUICustomization"; // Apply UI customization on load (prevent FOUC)

const TreOS = lazy(() => import("./pages/TreOS"));
const TrejenPage = lazy(() => import("./pages/TrejenPage"));
const SimitciPage = lazy(() => import("./pages/SimitciPage"));
const TreNtPage = lazy(() => import("./pages/TreNtPage"));
const TreForgePage = lazy(() => import("./pages/TreForgePage"));
const TreFikPage = lazy(() => import("./pages/TreFikPage"));
const TreAkademiPage = lazy(() => import("./pages/TreAkademiPage"));
const queryClient = new QueryClient();

const ReminderNotificationRunner = () => {
  const { checkReminders, checkSupportiveNotifications } = useNotifications();

  useEffect(() => {
    void checkReminders(true);
    void checkSupportiveNotifications();
    const intervalId = window.setInterval(() => {
      void checkReminders();
      void checkSupportiveNotifications();
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, [checkReminders, checkSupportiveNotifications]);

  return null;
};

const App = () => (
  <LanguageProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ScreenAnalysisTrigger />
        <LocalSchedulerRunner />
        <NotificationReplyListener />
        <ReminderNotificationRunner />
        <BrowserRouter>
          <AvatarProvider>
            <Routes>
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/istatistik" element={<Stats />} />
              <Route path="/capabilities" element={<Capabilities />} />
              <Route path="/starred" element={<Starred />} />
              <Route path="/store" element={<Store />} />
              <Route path="/trejen" element={
                <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">Trejen yükleniyor...</main>}>
                  <TrejenPage />
                </Suspense>
              } />
              <Route path="/treos" element={
                <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-950 font-mono text-emerald-400">TreOS Terminal yükleniyor...</main>}>
                  <TreOS />
                </Suspense>
              } />
              <Route path="/simitci" element={
                <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-background text-foreground">si-MİTÇİ yükleniyor...</main>}>
                  <SimitciPage />
                </Suspense>
              } />
              <Route path="/tre-nt" element={
                <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">Tre-nt yükleniyor...</main>}>
                  <TreNtPage />
                </Suspense>
              } />
              <Route path="/treforge" element={
                <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-background text-foreground">TreForge yükleniyor...</main>}>
                  <TreForgePage />
                </Suspense>
              } />
              <Route path="/tre-fik" element={
                <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">Tre-fik yükleniyor...</main>}>
                  <TreFikPage />
                </Suspense>
              } />
              <Route path="/tre-akademi" element={
                <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">Tre Akademi yükleniyor...</main>}>
                  <TreAkademiPage />
                </Suspense>
              } />

              <Route path="/voice-chat" element={<VoiceChat />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/demo" element={<DemoChat />} />
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
          </AvatarProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </LanguageProvider>
);

export default App;
