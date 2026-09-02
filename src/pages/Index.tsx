import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useChatbot } from '@/hooks/useChatbot';
import { useAuth } from '@/hooks/useAuth';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useGeneratedItems } from '@/hooks/useGeneratedItems';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/* ---------- Chat lock: local-only IndexedDB storage ---------- */
const LOCK_DB = 'tre_chat_locks';
const LOCK_STORE = 'locks';

const openLockDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(LOCK_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(LOCK_STORE)) db.createObjectStore(LOCK_STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const listLocks = async (): Promise<{ id: string; hash: string }[]> => {
  const db = await openLockDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(LOCK_STORE, 'readonly').objectStore(LOCK_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
};

const putLock = async (id: string, hash: string) => {
  const db = await openLockDb();
  db.transaction(LOCK_STORE, 'readwrite').objectStore(LOCK_STORE).put({ id, hash });
};

const removeLock = async (id: string) => {
  const db = await openLockDb();
  db.transaction(LOCK_STORE, 'readwrite').objectStore(LOCK_STORE).delete(id);
};

const hashPassword = async (pw: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
};


const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { preferences } = useUserPreferences();
  const navigate = useNavigate();
  const location = useLocation();
  
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
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]); // session only
  const [lockDialog, setLockDialog] = useState<null | { mode: 'set' | 'enter'; convId: string; openAfter?: boolean }>(null);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');

  const lockedIds = locks.map((l) => l.id);
  const isCurrentLocked = !!currentConversationId && lockedIds.includes(currentConversationId);
  const isCurrentHidden = isCurrentLocked && !unlockedIds.includes(currentConversationId!);

  useEffect(() => {
    listLocks().then(setLocks).catch(() => {});
  }, []);

  // Auto-lock when leaving the app / tab or unmounting
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

  const openLockDialog = (mode: 'set' | 'enter', convId: string, openAfter = false) => {
    setPwInput('');
    setPwError('');
    setLockDialog({ mode, convId, openAfter });
  };

  const handleToggleLock = () => {
    if (!currentConversationId) {
      toast.info('Önce bir sohbet seçin');
      return;
    }
    openLockDialog(isCurrentLocked ? 'enter' : 'set', currentConversationId);
  };

  const handleSelectConversation = (id: string) => {
    if (lockedIds.includes(id) && !unlockedIds.includes(id)) {
      openLockDialog('enter', id, true);
      return;
    }
    selectConversation(id);
  };

  const submitLockDialog = async () => {
    if (!lockDialog) return;
    const pw = pwInput.trim();
    if (lockDialog.mode === 'set') {
      if (pw.length < 4) { setPwError('Şifre en az 4 karakter olmalı'); return; }
      const hash = await hashPassword(pw);
      await putLock(lockDialog.convId, hash);
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
      await removeLock(lockDialog.convId);
      setLocks((prev) => prev.filter((l) => l.id !== lockDialog.convId));
      setUnlockedIds((prev) => [...prev, lockDialog.convId]);
      toast.success('Kilit kaldırıldı 🔓');
    }
    setLockDialog(null);
  };


  // Open sidebar on desktop by default
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

  // Wake word: "Hey Tre" -> open voice chat
  useWakeWord(() => {
    toast.success('Seni duyuyorum...');
    navigate('/voice-chat');
  });

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Shared content from PWA Share Target (/share-target)
  const sharedHandledRef = useRef(false);
  useEffect(() => {
    const sharedText = (location.state as { sharedText?: string } | null)?.sharedText;
    if (!sharedText || sharedHandledRef.current || !user) return;
    sharedHandledRef.current = true;
    window.history.replaceState({}, '');
    sendMessage(sharedText);
  }, [location.state, user, sendMessage]);

  // Jump to a starred message (/starred → "Sohbete git")
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



  // Infinite scroll-up state
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

  // Auto-scroll to bottom (skip while prepending older messages)
  useEffect(() => {
    const scrollElement = getViewport();
    if (!scrollElement) return;
    if (prependingRef.current) {
      // Keep the reading position stable after older messages are prepended
      scrollElement.scrollTop = scrollElement.scrollHeight - prevScrollHeightRef.current;
      prependingRef.current = false;
      return;
    }
    scrollElement.scrollTop = scrollElement.scrollHeight;
  }, [messages, isTyping]);

  // Track processed message IDs to avoid re-saving items on each render
  const processedIdsRef = useRef<Set<string>>(new Set());

  // Track all bot-generated items (images, GIFs, code files, audio, video, docs) → IndexedDB
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'bot') return;
    if (processedIdsRef.current.has(lastMessage.id)) return;
    processedIdsRef.current.add(lastMessage.id);

    const content = lastMessage.content;
    const promptMatch = content.match(/\*"([^"]+)"\*/);
    const prompt = promptMatch?.[1];

    // 1) Generated images (markdown ![]() with data: or http url)
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

    // 2) Animated frames block → save as JSON (GIF-like sequence)
    const framesMatch = content.match(/\[ANIMATED_FRAMES\]([\s\S]*?)\[\/ANIMATED_FRAMES\]/);
    if (framesMatch) {
      addGeneratedText({
        name: `animation-${Date.now()}.json`,
        content: framesMatch[1].trim(),
        mimeType: 'application/json',
        prompt,
      });
    }

    // 3) File blocks: [FILE:name]...[/FILE] (code, docs, etc.)
    const fileRegex = /\[FILE:([^\]]+)\]\n([\s\S]*?)\n\[\/FILE\]/g;
    let fm: RegExpExecArray | null;
    while ((fm = fileRegex.exec(content)) !== null) {
      addGeneratedText({ name: fm[1].trim(), content: fm[2], prompt });
    }

    // 4) Audio / video / apk / iso / pptx / pdf / word / excel via [Ek dosya: name](url)
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
    // Send the analysis as a message with the image
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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background bg-grid overflow-x-hidden">
      {/* Gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      <div className="relative z-10 flex h-screen h-[100dvh] max-w-7xl mx-auto overflow-hidden">
        {/* Conversation Sidebar */}
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
        
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
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
          
          <div className="flex-1 overflow-hidden" ref={scrollRef}>
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
              <ScrollArea className="h-full" onScrollCapture={handleChatScroll}>
                <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
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
                          <ChatMessage message={message} onReact={reactToMessage} chatId={currentConversationId} chatTitle={conversations.find(c => c.id === currentConversationId)?.title} />
                        </SwipeableMessage>
                      ) : (
                        <ChatMessage message={message} onReact={reactToMessage} chatId={currentConversationId} chatTitle={conversations.find(c => c.id === currentConversationId)?.title} />
                      )}
                    </div>
                  ))}

                  {isTyping && <TypingIndicator />}
                </div>
              </ScrollArea>
            )}
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
        
        {/* Knowledge Panel - Hidden on mobile */}
        <div
          className={`hidden lg:block transition-all duration-300 overflow-hidden ${
            isPanelOpen ? 'w-80' : 'w-0'
          }`}
        >
          <KnowledgePanel
            knowledgeBase={knowledgeBase}
            onDelete={deleteKnowledgeItem}
            onClear={clearKnowledge}
          />
        </div>
      </div>

      {/* Generated Items Panel */}
      <GeneratedItemsPanel
        items={generatedItems}
        onDelete={removeGenerated}
        onRename={renameGenerated}
        onClear={clearGenerated}
        isOpen={isImageHistoryOpen}
        onClose={() => setIsImageHistoryOpen(false)}
      />

      {/* User Memory Panel */}
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

      {/* Live Camera View */}
      <LiveCameraView
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onAnalysisComplete={handleCameraAnalysis}
      />

      {/* Live Screen Share View */}
      <LiveScreenShareView
        isOpen={isScreenShareOpen}
        onClose={() => setIsScreenShareOpen(false)}
        onAnalysisComplete={handleCameraAnalysis}
      />

      {/* Connected Accounts Panel */}
      <ConnectedAccountsPanel
        isOpen={isAccountsPanelOpen}
        onClose={() => setIsAccountsPanelOpen(false)}
      />

      {/* Chat lock dialog */}
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

export default Index;
