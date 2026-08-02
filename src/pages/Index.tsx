import { useState, useRef, useEffect } from 'react';
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
import { Loader2 } from 'lucide-react';

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

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
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
          onSelectConversation={selectConversation}
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
          />
          
          <div className="flex-1 overflow-hidden" ref={scrollRef}>
            {messages.length === 0 ? (
              <EmptyState onSuggestionClick={(text) => sendMessage(text, undefined, text.startsWith('🎨') ? 'image' : undefined)} />
            ) : (
              <ScrollArea className="h-full">
                <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                  {messages.map((message) => (
                    preferences.swipe_to_delete_enabled ? (
                      <SwipeableMessage 
                        key={message.id} 
                        messageId={message.id}
                        onDelete={() => deleteMessage(message.id)}
                      >
                        <ChatMessage message={message} onReact={reactToMessage} />
                      </SwipeableMessage>
                    ) : (
                      <ChatMessage key={message.id} message={message} onReact={reactToMessage} />
                    )
                  ))}
                  {isTyping && <TypingIndicator />}
                </div>
              </ScrollArea>
            )}
          </div>
          
          <ChatInput
            onSend={(msg, fileUrl, genType) => sendMessage(msg, fileUrl, genType)}
            disabled={isTyping}
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
    </div>
  );
};

export default Index;
