import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatbot } from '@/hooks/useChatbot';
import { useAuth } from '@/hooks/useAuth';
import { useImageHistory } from '@/hooks/useImageHistory';
import { ChatHeader } from '@/components/ChatHeader';
import { ChatMessage } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { TypingIndicator } from '@/components/TypingIndicator';
import { KnowledgePanel } from '@/components/KnowledgePanel';
import { EmptyState } from '@/components/EmptyState';
import { ConversationSidebar } from '@/components/ConversationSidebar';
import { ImageHistoryPanel } from '@/components/ImageHistoryPanel';
import { UserMemoryPanel } from '@/components/UserMemoryPanel';
import { SwipeableMessage } from '@/components/SwipeableMessage';
import { LiveCameraView } from '@/components/LiveCameraView';
import { ConnectedAccountsPanel } from '@/components/ConnectedAccountsPanel';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
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
  } = useChatbot();

  const { images, addImage, deleteImage, clearImages } = useImageHistory();

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isImageHistoryOpen, setIsImageHistoryOpen] = useState(false);
  const [isMemoryPanelOpen, setIsMemoryPanelOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
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

  // Track generated images from messages
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'bot') {
      const imageMatch = lastMessage.content.match(/!\[([^\]]*)\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/);
      const promptMatch = lastMessage.content.match(/\*"([^"]+)"\*/);
      
      if (imageMatch && promptMatch) {
        const imageUrl = imageMatch[2];
        const prompt = promptMatch[1];
        
        // Check if this image is already in history
        const exists = images.some(img => img.url === imageUrl);
        if (!exists) {
          addImage(imageUrl, prompt);
        }
      }
    }
  }, [messages, addImage, images]);

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
            imageHistoryCount={images.length}
            onToggleMemoryPanel={() => setIsMemoryPanelOpen(!isMemoryPanelOpen)}
            memoryCount={memories.length + interests.length}
            onToggleConnectedAccounts={() => setIsAccountsPanelOpen(!isAccountsPanelOpen)}
          />
          
          <div className="flex-1 overflow-hidden" ref={scrollRef}>
            {messages.length === 0 ? (
              <EmptyState onSuggestionClick={(text) => sendMessage(text, undefined, text.startsWith('🎨') ? 'image' : undefined)} />
            ) : (
              <ScrollArea className="h-full">
                <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                  {messages.map((message) => (
                    <SwipeableMessage 
                      key={message.id} 
                      messageId={message.id}
                      onDelete={() => deleteMessage(message.id)}
                    >
                      <ChatMessage message={message} />
                    </SwipeableMessage>
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

      {/* Image History Panel */}
      <ImageHistoryPanel
        images={images}
        onRegenerate={handleRegenerateImage}
        onDelete={deleteImage}
        onClear={clearImages}
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
      />

      {/* Live Camera View */}
      <LiveCameraView
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onAnalysisComplete={handleCameraAnalysis}
      />
    </div>
  );
};

export default Index;
