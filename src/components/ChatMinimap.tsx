import React, { useEffect, useRef, useState } from 'react';

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
}

interface ChatMinimapProps {
  messages: Message[];
  scrollRef: React.RefObject<HTMLDivElement>;
}

const ChatMinimap: React.FC<ChatMinimapProps> = ({ messages, scrollRef }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Check screen width and update visibility
  useEffect(() => {
    const checkWidth = () => {
      setIsVisible(window.innerWidth >= 1024);
    };

    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  // Track scroll position for viewport highlight
  useEffect(() => {
    if (!isVisible || messages.length === 0) return;

    const getScrollElement = (): HTMLElement | null => {
      if (!scrollRef.current) return null;
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
      return viewport || scrollRef.current;
    };

    const handleScroll = () => {
      const scrollElement = getScrollElement();
      if (!scrollElement) return;
      setScrollPosition(scrollElement.scrollTop);
    };

    const scrollElement = getScrollElement();
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll, true);
      return () => scrollElement.removeEventListener('scroll', handleScroll, true);
    }
  }, [isVisible, messages.length, scrollRef]);

  // Handle click on indicator to scroll to message
  const handleIndicatorClick = (messageId: string, index: number) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!isVisible || messages.length === 0) return null;

  // Calculate which messages are visible in viewport
  const getScrollElement = (): HTMLElement | null => {
    if (!scrollRef.current) return null;
    const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    return viewport || scrollRef.current;
  };

  const scrollElement = getScrollElement();
  const scrollHeight = scrollElement?.scrollHeight || 1;
  const clientHeight = scrollElement?.clientHeight || 1;
  const scrollTop = scrollElement?.scrollTop || 0;

  // Only render user messages as indicators
  const userMessages = messages
    .map((msg, idx) => ({ msg, idx }))
    .filter(({ msg }) => msg.role === 'user');

  return (
    <div className="hidden lg:flex flex-col gap-2 w-16 px-2 py-4 border-l border-border/30 bg-background/80 backdrop-blur-sm overflow-y-auto">
      {userMessages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/50">
          —
        </div>
      ) : (
        userMessages.map(({ msg, idx }) => {
          // Calculate indicator position based on message index in full messages array
          const position = (idx / Math.max(messages.length - 1, 1)) * 100;

          return (
            <button
              key={msg.id}
              onClick={() => handleIndicatorClick(msg.id, idx)}
              title={`Jump to message ${idx + 1}`}
              className="group relative flex flex-col items-center gap-1 transition-opacity hover:opacity-100 opacity-70"
            >
              {/* Indicator dot */}
              <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm group-hover:w-2.5 group-hover:h-2.5 transition-all" />

              {/* Hover tooltip */}
              <span className="hidden group-hover:block absolute right-full mr-2 px-2 py-1 text-xs whitespace-nowrap bg-secondary text-secondary-foreground rounded pointer-events-none">
                Q{idx + 1}
              </span>
            </button>
          );
        })
      )}

      {/* Viewport indicator (shows current scroll position) */}
      {scrollHeight > clientHeight && (
        <div className="mt-auto pt-2 border-t border-border/20">
          <div className="text-xs text-muted-foreground/50 text-center">
            {Math.round((scrollTop / (scrollHeight - clientHeight)) * 100)}%
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatMinimap;
