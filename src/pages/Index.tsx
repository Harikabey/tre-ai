import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatbot } from '@/hooks/useChatbot';
import { useAuth } from '@/hooks/useAuth';
import { ChatHeader } from '@/components/ChatHeader';
import { ChatMessage } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { TypingIndicator } from '@/components/TypingIndicator';
import { KnowledgePanel } from '@/components/KnowledgePanel';
import { EmptyState } from '@/components/EmptyState';
import { ConversationSidebar } from '@/components/ConversationSidebar';
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
    setIsLearningMode,
    setThinkingMode,
    sendMessage,
    clearMessages,
    clearKnowledge,
    deleteKnowledgeItem,
    selectConversation,
    createNewConversation,
    deleteConversation,
  } = useChatbot();

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
    <div className="min-h-screen bg-background bg-grid">
      {/* Gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      <div className="relative z-10 flex h-screen max-w-7xl mx-auto">
        {/* Conversation Sidebar */}
        <ConversationSidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          onSelectConversation={selectConversation}
          onNewConversation={createNewConversation}
          onDeleteConversation={deleteConversation}
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
          />
          
          <div className="flex-1 overflow-hidden" ref={scrollRef}>
            {messages.length === 0 ? (
              <EmptyState />
            ) : (
              <ScrollArea className="h-full">
                <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                  {messages.map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))}
                  {isTyping && <TypingIndicator />}
                </div>
              </ScrollArea>
            )}
          </div>
          
          <ChatInput
            onSend={sendMessage}
            disabled={isTyping}
            pendingQuestion={pendingQuestion}
            thinkingMode={thinkingMode}
            onThinkingModeChange={setThinkingMode}
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
    </div>
  );
};

export default Index;
