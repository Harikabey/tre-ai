// FILE: src/pages/Index.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useChatbot } from '@/hooks/useChatbot';
import { useAuth } from '@/hooks/useAuth';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useGeneratedItems } from '@/hooks/useGeneratedItems';
import DemoChat from '@/pages/DemoChat';
import { ChatHeader } from '@/components/ChatHeader';
import { ChatMessage } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { TypingIndicator } from '@/components/TypingIndicator';
import { KnowledgePanel } from '@/components/KnowledgePanel';
import { EmptyState } from '@/components/EmptyState';
import { ConversationSidebar } from '@/components/ConversationSidebar';
import { GeneratedItemsPanel } from '@/components/GeneratedItemsPanel';
import { UserMemoryPanel } from '@/components/UserMemoryPanel';
import { SwipeableMessage } from '@/components/SwipeableMessage';
import { LiveCameraView } from '@/components/LiveCameraView';
import { LiveScreenShareView } from '@/components/LiveScreenShareView';
import { useWakeWord } from '@/hooks/useWakeWord';
import { exportChatToPdf } from '@/utils/exportChatPdf';
import { toast } from 'sonner';
import { ConnectedAccountsPanel } from '@/components/ConnectedAccountsPanel';
import { ChatBackground } from '@/components/ChatBackground';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import {
  clearSharedFiles,
  deleteSharedFile,
  getSharedFiles,
  MAX_SHARED_FILE_SIZE,
} from '@/lib/shared-files';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ===== YENİ IMPORT =====
import CodeCanvasPanel from '@/components/CodeCanvasPanel';
import ChatMinimap from '@/components/ChatMinimap';

const hashPassword = async (pw: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

const extractSharedVideoFrame = (file: File): Promise<string | null> => new Promise((resolve) => {
  const video = document.createElement('video');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const objectUrl = URL.createObjectURL(file);
  const cleanup = () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(objectUrl);
  };

  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.onloadedmetadata = () => {
    video.currentTime = Number.isFinite(video.duration) ? Math.min(1, video.duration / 2) : 0;
  };
  video.onseeked = () => {
    try {
      if (!context || !video.videoWidth || !video.videoHeight) {
        resolve(null);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    } catch {
      resolve(null);
    } finally {
      cleanup();
    }
  };
  video.onerror = () => {
    cleanup();
    resolve(null);
  };
  video.src = objectUrl;
  video.load();
});

const AuthenticatedIndex = () => {
  const { user, loading: authLoading } = useAuth();
  const { preferences } = useUserPreferences();
  const navigate = useNavigate();
  const location = useLocation();

  // ===== CANVAS / KOD ÖNİZLEME STATE'LERİ (YENİ) =====
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [canvasCode, setCanvasCode] = useState('');
  const [canvasFileName, setCanvasFileName] = useState('');

  const handleOpenCanvas = (code: string, fileName: string) => {
    setCanvasCode(code);
    setCanvasFileName(fileName);
    setIsCanvasOpen(true);
  };

  const handleCloseCanvas = () => {
    setIsCanvasOpen(false);
    setCanvasCode('');
    setCanvasFileName('');
  };

  // ===== CHATBOT HOOKS =====
  const {
    messages,
    conversations,
    currentConversationId,
    knowledgeBase,
    isLearningMode,
    isTyping,
    pendingQuestion,
    thinkingMode,
    memories,
    interests,
    recentMoods,
    currentMood,
    setIsLearningMode,
    setThinkingMode,
    sendMessage,
    reactToMessage,
    clearMessages,
    deleteMessage,
    clearKnowledge,
    deleteKnowledgeItem,
    selectConversation,
    hasMoreMessages,
    isLoadingOlder,
    loadOlderMessages,
    createNewConversation,
    deleteConversation,
    renameConversation,
    deleteMemory,
    deleteInterest,
    addMemory,
    updateMemory,
    addInterest,
    updateInterest,
    hideMessages,
  } = useChatbot();

  const {
    items: generatedItems,
    addFromUrl: addGeneratedUrl,
    addFromText: addGeneratedText,
    addFromBlob: addGeneratedBlob,
    remove: removeGenerated,
    rename: renameGenerated,
    clear: clearGenerated,
  } = useGeneratedItems();

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isImageHistoryOpen, setIsImageHistoryOpen] = useState(false);
  const [isMemoryPanelOpen, setIsMemoryPanelOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isScreenShareOpen, setIsScreenShareOpen] = useState(false);
  const [isAccountsPanelOpen, setIsAccountsPanelOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ---------- Chat lock state ---------- */
  const [locks, setLocks] = useState<{ id: string; hash: string }[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [lockDialog, setLockDialog] = useState<null | { mode: 'set' | 'enter'; convId: string; openAfter?: boolean }>(null);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');

  const lockedIds = locks.map((l) => l.id);
  const isCurrentLocked = !!currentConversationId && lockedIds.includes(currentConversationId);
  const isCurrentHidden = isCurrentLocked && !unlockedIds.includes(currentConversationId!);

  // Never keep a locked chat's messages in memory while it is locked
  useEffect(() => {
    if (isCurrentHidden) hideMessages();
  }, [isCurrentHidden, messages.length, hideMessages]);

  useEffect(() => {
    const relock = () => setUnlockedIds([]);
    const onVisibility = () => { if (document.visibilityState === 'hidden') relock(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', relock);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', relock);
      relock();
    };
  }, []);

  const openLockDialog = useCallback((mode: 'set' | 'enter', convId: string, openAfter = false) => {
    setPwInput('');
    setPwError('');
    setLockDialog({ mode, convId, openAfter });
  }, []);

  const handleToggleLock = () => {
    if (!currentConversationId) {
      toast.info('Önce bir sohbet seçin');
      return;
    }
    openLockDialog(isCurrentLocked ? 'enter' : 'set', currentConversationId);
  };

  const handleSelectConversation = useCallback((id: string) => {
    if (locks.some((lock) => lock.id === id) && !unlockedIds.includes(id)) {
      openLockDialog('enter', id, true);
      return;
    }
    selectConversation(id);
  }, [locks, unlockedIds, openLockDialog, selectConversation]);

  const handledNotificationConversationRef = useRef<string | null>(null);
  useEffect(() => {
    const conversationId = new URLSearchParams(location.search).get('conversationId');
    if (!user || !conversationId || handledNotificationConversationRef.current === conversationId) return;
    if (!conversations.some((conversation) => conversation.id === conversationId)) return;
    handledNotificationConversationRef.current = conversationId;
    handleSelectConversation(conversationId);
  }, [location.search, user, conversations, handleSelectConversation]);

  const submitLockDialog = async () => {
    if (!lockDialog) return;
    const pw = pwInput.trim();
    if (lockDialog.mode === 'set') {
      if (pw.length < 4) { setPwError('Şifre en az 4 karakter olmalı'); return; }
      const hash = await hashPassword(pw);
      setLocks((prev) => [...prev.filter((l) => l.id !== lockDialog.convId), { id: lockDialog.convId, hash }]);
      setUnlockedIds((prev) => prev.filter((i) => i !== lockDialog.convId));
      setLockDialog(null);
      toast.success('Sohbet kilitlendi 🔒');
      return;
    }
    const hash = await hashPassword(pw);
    const lock = locks.find((l) => l.id === lockDialog.convId);
    if (!lock || lock.hash !== hash) { setPwError('Şifre hatalı'); return; }
    if (lockDialog.openAfter) {
      setUnlockedIds((prev) => [...prev, lockDialog.convId]);
      selectConversation(lockDialog.convId);
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
      toast.success('Sohbet açıldı 🔓');
    } else {
      setLocks((prev) => prev.filter((l) => l.id !== lockDialog.convId));
      setUnlockedIds((prev) => [...prev, lockDialog.convId]);
      toast.success('Kilit kaldırıldı 🔓');
    }
    setLockDialog(null);
  };

  useEffect(() => {
    const checkWidth = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      }
    };
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  useWakeWord(() => {
    toast.success('Seni duyuyorum...');
    navigate('/voice-chat');
  });

  useEffect(() => {
    const pendingRedirect = sessionStorage.getItem('tre-post-auth-redirect');
    if (!pendingRedirect) return;
    sessionStorage.removeItem('tre-post-auth-redirect');
    if (!pendingRedirect.startsWith('/') || pendingRedirect.startsWith('//')) {
      console.error('Giriş sonrası yönlendirme adresi geçersiz.');
      return;
    }

    const target = new URL(pendingRedirect, window.location.origin);
    if (target.origin === window.location.origin) {
      navigate(`${target.pathname}${target.search}${target.hash}`, { replace: true });
    }
  }, [location.hash, location.pathname, location.search, navigate]);

  const sharedHandledRef = useRef(false);
  const sharedErrorHandledRef = useRef(false);
  useEffect(() => {
    const search = new URLSearchParams(location.search);
    const sharedError = search.get('sharedError');
    if (sharedError && !sharedErrorHandledRef.current) {
      sharedErrorHandledRef.current = true;
      toast.error(sharedError === 'too-large'
        ? 'Dosya boyutu 10 MB sınırını aşıyor'
        : 'Paylaşılan dosya alınamadı');
      navigate('/', { replace: true });
      return;
    }

    if (search.get('shared') !== 'true' || sharedHandledRef.current || !user) return;
    sharedHandledRef.current = true;
    void (async () => {
      let files;
      try {
        files = await getSharedFiles();
      } catch (error) {
        console.error('Paylaşılan dosyalar okunamadı.', error);
        toast.error('Paylaşılan dosyalar açılamadı');
        navigate('/', { replace: true });
        return;
      }

      if (files.length === 0) {
        toast.info('Tre ile paylaşılmış dosya bulunamadı');
        navigate('/', { replace: true });
        return;
      }

      let allFilesHandled = true;
      for (const record of files) {
        const file = record.file;
        if (file.size > MAX_SHARED_FILE_SIZE) {
          toast.error(`${file.name}: Dosya boyutu 10 MB sınırını aşıyor`);
          try {
            await deleteSharedFile(record.id);
          } catch (error) {
            console.error(`${file.name} yerel paylaşımdan silinemedi.`, error);
            allFilesHandled = false;
          }
          continue;
        }

        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !sessionData.session) throw new Error('Dosyayı yüklemek için oturum açılamadı.');

          const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${encodeURIComponent(file.name)}`;
          const filePath = `${user.id}/${fileName}`;
          const { error: uploadError } = await supabase.storage
            .from('chat-attachments')
            .upload(filePath, file, { contentType: file.type, upsert: false });
          if (uploadError) throw uploadError;

          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('chat-attachments')
            .createSignedUrl(filePath, 3600);
          if (signedUrlError) throw signedUrlError;

          let fileDetails = '';
          const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
          const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv)$/i.test(file.name);

          if (isImage) {
            try {
              const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-image`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                  Authorization: `Bearer ${sessionData.session.access_token}`,
                },
                body: JSON.stringify({ imageUrl: signedUrlData.signedUrl, prompt: `Bu dosyayı analiz et: ${file.name}` }),
              });
              if (!response.ok) throw new Error(`Görsel analizi başarısız: HTTP ${response.status}`);
              const result: { analysis?: string } = await response.json();
              fileDetails = result.analysis ? `\n\n--- Görsel Analizi ---\n${result.analysis}` : '';
            } catch (error) {
              console.error(`${file.name} görsel olarak analiz edilemedi.`, error);
              toast.error(`${file.name}: Görsel analiz edilemedi`);
            }
          } else if (isVideo) {
            const frame = await extractSharedVideoFrame(file);
            if (!frame) {
              toast.error(`${file.name}: Video karesi çıkarılamadı`);
            } else {
              try {
                const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-image`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                    Authorization: `Bearer ${sessionData.session.access_token}`,
                  },
                  body: JSON.stringify({
                    imageUrl: frame,
                    prompt: `Bu video karesini analiz et. Kaynak dosya: ${file.name}`,
                  }),
                });
                if (!response.ok) throw new Error(`Video karesi analizi başarısız: HTTP ${response.status}`);
                const result: { analysis?: string } = await response.json();
                fileDetails = result.analysis ? `\n\n--- Video Analizi ---\n${result.analysis}` : '';
              } catch (error) {
                console.error(`${file.name} video karesi analiz edilemedi.`, error);
                toast.error(`${file.name}: Video analiz edilemedi`);
              }
            }
          } else {
            try {
              const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/read-document`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                  Authorization: `Bearer ${sessionData.session.access_token}`,
                },
                body: JSON.stringify({
                  fileUrl: signedUrlData.signedUrl,
                  fileName: file.name,
                  mimeType: file.type,
                }),
              });
              if (!response.ok) throw new Error(`Dosya içeriği okunamadı: HTTP ${response.status}`);
              const result: { content?: string } = await response.json();
              fileDetails = result.content
                ? `\n\n--- Dosya İçeriği ---\n${result.content.slice(0, 20000)}`
                : '';
            } catch (error) {
              console.error(`${file.name} içeriği okunamadı.`, error);
              toast.error(`${file.name}: Dosya içeriği okunamadı`);
            }
          }

          const displayName = file.name.replace(/[\]\r\n]/g, '_');
          const message = `Bu dosyayı analiz et: ${file.name}\n\n[Ek dosya: ${displayName}](${signedUrlData.signedUrl})${fileDetails}`;
          await sendMessage(message);
          await deleteSharedFile(record.id);
        } catch (error) {
          console.error(`${file.name} Tre'ye aktarılamadı.`, error);
          toast.error(`${file.name} Tre'ye yüklenemedi`);
          allFilesHandled = false;
        }
      }

      if (allFilesHandled) {
        await clearSharedFiles();
        navigate('/', { replace: true });
      }
    })();
  }, [location.search, navigate, sendMessage, user]);

  useEffect(() => {
    const sharedText = (location.state as { sharedText?: string } | null)?.sharedText;
    if (!sharedText || sharedHandledRef.current || !user) return;
    sharedHandledRef.current = true;
    window.history.replaceState({}, '');
    sendMessage(sharedText);
  }, [location.state, user, sendMessage]);

  const starredNavRef = useRef<string | null>(null);
  useEffect(() => {
    const st = location.state as { openConversationId?: string | null; scrollToMessageId?: string } | null;
    if (!st?.scrollToMessageId || !user) return;
    if (starredNavRef.current === st.scrollToMessageId) return;
    starredNavRef.current = st.scrollToMessageId;
    if (st.openConversationId && st.openConversationId !== currentConversationId) {
      selectConversation(st.openConversationId);
    }
    const target = st.scrollToMessageId;
    let tries = 0;
    const timer = setInterval(() => {
      const el = document.getElementById(`msg-${target}`);
      if (el) {
        clearInterval(timer);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-primary');
        setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 2500);
        window.history.replaceState({}, '');
      } else if (++tries > 40) {
        clearInterval(timer);
      }
    }, 150);
    return () => clearInterval(timer);
  }, [location.state, user, currentConversationId, selectConversation]);

  const prependingRef = useRef(false);
  const prevScrollHeightRef = useRef(0);

  const getViewport = () =>
    scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;

  const handleChatScroll = useCallback(() => {
    const el = getViewport();
    if (!el || isLoadingOlder || !hasMoreMessages) return;
    if (el.scrollTop < 60) {
      prependingRef.current = true;
      prevScrollHeightRef.current = el.scrollHeight;
      loadOlderMessages();
    }
  }, [isLoadingOlder, hasMoreMessages, loadOlderMessages]);

  useEffect(() => {
    const scrollElement = getViewport();
    if (!scrollElement) return;
    if (prependingRef.current) {
      scrollElement.scrollTop = scrollElement.scrollHeight - prevScrollHeightRef.current;
      prependingRef.current = false;
      return;
    }
    scrollElement.scrollTop = scrollElement.scrollHeight;
  }, [messages, isTyping]);

  const processedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'bot') return;
    if (processedIdsRef.current.has(lastMessage.id)) return;
    processedIdsRef.current.add(lastMessage.id);

    const content = lastMessage.content;
    const promptMatch = content.match(/\*"([^"]+)"\*/);
    const prompt = promptMatch?.[1];

    const imageRegex = /!\[([^\]]*)\]\((data:image\/[^)]+|https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|webp|gif)[^\s)]*)\)/gi;
    let m: RegExpExecArray | null;
    let imgIdx = 0;
    while ((m = imageRegex.exec(content)) !== null) {
      const url = m[2];
      const alt = m[1] || prompt || `image-${Date.now()}`;
      const isGif = url.toLowerCase().includes('.gif') || url.startsWith('data:image/gif');
      const ext = isGif ? 'gif' : (url.match(/\.(png|jpg|jpeg|webp)/i)?.[1] || 'png');
      const safeName = `${alt.slice(0, 40).replace(/[^a-zA-Z0-9-_ ]/g, '_') || 'image'}${imgIdx > 0 ? `-${imgIdx}` : ''}.${ext}`;
      addGeneratedUrl({ url, name: safeName, prompt, kind: isGif ? 'gif' : 'image' });
      imgIdx++;
    }

    const framesMatch = content.match(/\[ANIMATED_FRAMES\]([\s\S]*?)\[\/ANIMATED_FRAMES\]/);
    if (framesMatch) {
      addGeneratedText({
        name: `animation-${Date.now()}.json`,
        content: framesMatch[1].trim(),
        mimeType: 'application/json',
        prompt,
      });
    }

    const fileRegex = /\[FILE:([^\]]+)\]\n([\s\S]*?)\n\[\/FILE\]/g;
    let fm: RegExpExecArray | null;
    while ((fm = fileRegex.exec(content)) !== null) {
      addGeneratedText({ name: fm[1].trim(), content: fm[2], prompt });
    }

    const attachRegex = /\[(?:Ek dosya|İndir|Dosya):\s*([^\]]+)\]\((https?:\/\/[^\s)]+|data:[^)]+)\)/gi;
    let am: RegExpExecArray | null;
    while ((am = attachRegex.exec(content)) !== null) {
      addGeneratedUrl({ name: am[1].trim(), url: am[2], prompt });
    }
  }, [messages, addGeneratedUrl, addGeneratedText]);

  const handleRegenerateImage = (prompt: string) => {
    setIsImageHistoryOpen(false);
    sendMessage(`🎨 Görsel oluştur: ${prompt}`, undefined, 'image');
  };

  const handleCameraAnalysis = (analysis: string, imageDataUrl: string) => {
    const messageContent = `📷 Canlı görüntü analizi:\n\n![Kamera görüntüsü](${imageDataUrl})\n\n**AI Analizi:**\n${analysis}`;
    sendMessage(messageContent);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className="mobile-9-16-frame min-h-screen min-h-[100dvh] bg-grid overflow-x-hidden"
    >
      <ChatBackground />
      {/* Gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5 pointer-events-none select-none overflow-hidden max-w-full" />

      <main className="relative z-10 flex h-screen h-[100dvh] max-w-7xl mx-auto w-full max-w-full overflow-x-hidden px-2 sm:px-4">
        <ConversationSidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          onSelectConversation={handleSelectConversation}
          lockedIds={lockedIds}
          onNewConversation={createNewConversation}
          onDeleteConversation={deleteConversation}
          onRenameConversation={renameConversation}
        />

        <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
          <ChatHeader
            isLearningMode={isLearningMode}
            onLearningModeChange={setIsLearningMode}
            onClearMessages={clearMessages}
            onTogglePanel={() => setIsPanelOpen(!isPanelOpen)}
            isPanelOpen={isPanelOpen}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            onToggleImageHistory={() => setIsImageHistoryOpen(!isImageHistoryOpen)}
            imageHistoryCount={generatedItems.length}
            onToggleMemoryPanel={() => setIsMemoryPanelOpen(!isMemoryPanelOpen)}
            memoryCount={memories.length + interests.length}
            onToggleConnectedAccounts={() => setIsAccountsPanelOpen(!isAccountsPanelOpen)}
            onExportPdf={async () => {
              if (!messages.length) {
                toast.info('Dışa aktarılacak mesaj yok');
                return;
              }
              const t = toast.loading('PDF hazırlanıyor...');
              try {
                const title = conversations.find(c => c.id === currentConversationId)?.title || 'Tre Sohbet';
                await exportChatToPdf(messages, title);
                toast.success('PDF indirildi', { id: t });
              } catch (e) {
                console.error(e);
                toast.error('PDF oluşturulamadı', { id: t });
              }
            }}
            isChatLocked={isCurrentLocked}
            onToggleLock={handleToggleLock}
          />

          <div className="flex-1 flex overflow-hidden min-w-0 w-full max-w-full">
            <div className="flex-1 overflow-hidden flex flex-col overflow-x-hidden w-full max-w-full" ref={scrollRef}>
              {isCurrentHidden ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-secondary/60 border border-border/50 flex items-center justify-center">
                    <Lock className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Bu sohbet kilitli</h2>
                    <p className="text-sm text-muted-foreground mt-1">İçeriği görmek için şifreyi girin</p>
                  </div>
                  <Button onClick={() => openLockDialog('enter', currentConversationId!, true)}>Şifreyi Gir</Button>
                </div>
              ) : messages.length === 0 ? (
                <EmptyState onSuggestionClick={(text) => sendMessage(text, undefined, text.startsWith('🎨') ? 'image' : undefined)} />
              ) : (
                <ScrollArea className="h-full w-full max-w-full overflow-x-hidden" onScrollCapture={handleChatScroll}>
                  <div className="w-full max-w-full overflow-x-hidden px-2 sm:px-4 space-y-3 sm:space-y-4">
                    {isLoadingOlder && (
                      <div className="flex justify-center py-2">
                        <span className="text-xs text-muted-foreground animate-pulse">Eski mesajlar yükleniyor…</span>
                      </div>
                    )}
                    {!hasMoreMessages && messages.length > 20 && (
                      <div className="text-center text-[11px] text-muted-foreground/70 py-1">Sohbetin başı</div>
                    )}
                    {messages.map((message) => (
                      <div key={message.id} id={`msg-${message.id}`} className="scroll-mt-20 rounded-2xl transition-colors">
                        {preferences.swipe_to_delete_enabled ? (
                          <SwipeableMessage
                            messageId={message.id}
                            onDelete={() => deleteMessage(message.id)}
                          >
                            <ChatMessage
                              message={message}
                              onReact={reactToMessage}
                              onPreview={handleOpenCanvas}
                              chatId={currentConversationId}
                              chatTitle={conversations.find(c => c.id === currentConversationId)?.title}
                            />
                          </SwipeableMessage>
                        ) : (
                          <ChatMessage
                            message={message}
                            onReact={reactToMessage}
                            onPreview={handleOpenCanvas}
                            chatId={currentConversationId}
                            chatTitle={conversations.find(c => c.id === currentConversationId)?.title}
                          />
                        )}
                      </div>
                    ))}
                    {isTyping && <TypingIndicator />}
                  </div>
                </ScrollArea>
              )}
            </div>

            <ChatMinimap messages={messages} scrollRef={scrollRef} />
          </div>

          <ChatInput
            onSend={(msg, fileUrl, genType) => sendMessage(msg, fileUrl, genType)}
            disabled={isTyping || isCurrentHidden}
            pendingQuestion={pendingQuestion}
            thinkingMode={thinkingMode}
            onThinkingModeChange={setThinkingMode}
            onOpenCamera={() => setIsCameraOpen(true)}
            onOpenScreenShare={() => setIsScreenShareOpen(true)}
            currentMood={currentMood?.mood}
          />
        </div>

        <div
          className={`fixed inset-y-0 right-0 z-50 lg:static lg:z-auto transition-all duration-300 overflow-hidden border-l border-border/50 bg-card/95 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none ${
            isPanelOpen
              ? 'translate-x-0 lg:w-80'
              : 'translate-x-full lg:translate-x-0 lg:w-0 pointer-events-none lg:pointer-events-auto'
          }`}
        >
          <KnowledgePanel
            knowledgeBase={knowledgeBase}
            onDelete={deleteKnowledgeItem}
            onClear={clearKnowledge}
            onClose={() => setIsPanelOpen(false)}
          />
        </div>
      </main>

      <GeneratedItemsPanel
        items={generatedItems}
        onDelete={removeGenerated}
        onRename={renameGenerated}
        onClear={clearGenerated}
        isOpen={isImageHistoryOpen}
        onClose={() => setIsImageHistoryOpen(false)}
      />

      <UserMemoryPanel
        isOpen={isMemoryPanelOpen}
        onClose={() => setIsMemoryPanelOpen(false)}
        memories={memories}
        interests={interests}
        recentMoods={recentMoods}
        currentMood={currentMood}
        onDeleteMemory={deleteMemory}
        onDeleteInterest={deleteInterest}
        onAddMemory={addMemory}
        onUpdateMemory={updateMemory}
        onAddInterest={addInterest}
        onUpdateInterest={updateInterest}
      />

      <LiveCameraView
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onAnalysisComplete={handleCameraAnalysis}
      />

      <LiveScreenShareView
        isOpen={isScreenShareOpen}
        onClose={() => setIsScreenShareOpen(false)}
        onAnalysisComplete={handleCameraAnalysis}
      />

      <ConnectedAccountsPanel
        isOpen={isAccountsPanelOpen}
        onClose={() => setIsAccountsPanelOpen(false)}
      />

      {/* ===== CODE CANVAS PANEL (YENİ) ===== */}
      <CodeCanvasPanel
        isOpen={isCanvasOpen}
        code={canvasCode}
        fileName={canvasFileName}
        onClose={handleCloseCanvas}
      />

      <Dialog open={!!lockDialog} onOpenChange={(o) => !o && setLockDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              {lockDialog?.mode === 'set' ? 'Şifre Belirle' : 'Şifreyi Gir'}
            </DialogTitle>
            <DialogDescription>
              {lockDialog?.mode === 'set'
                ? 'En az 4 karakterli bir şifre belirleyin. Şifre yalnızca bu cihazda saklanır.'
                : 'Sohbeti açmak için şifrenizi girin.'}
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pwInput}
            onChange={(e) => { setPwInput(e.target.value); setPwError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') submitLockDialog(); }}
            placeholder="••••"
          />
          {pwError && <p className="text-xs text-destructive">{pwError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLockDialog(null)}>İptal</Button>
            <Button onClick={submitLockDialog}>
              {lockDialog?.mode === 'set' ? 'Kilitle' : 'Aç'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return user ? <AuthenticatedIndex /> : <DemoChat />;
};

export default Index;
