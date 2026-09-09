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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Check screen width and update visibility
  useEffect(() => {
    const checkWidth = () => {
      setIsVisible(window.innerWidth >= 1024);
    };

    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  // Helper function to get scroll element
  const getScrollElement = (): HTMLElement | null => {
    if (!scrollRef.current) return null;
    // Try to find the Radix scroll area viewport
    const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    // Fallback to scrollRef.current if viewport not found
    return viewport || scrollRef.current;
  };

  // Draw minimap
  useEffect(() => {
    if (!canvasRef.current || !isVisible || messages.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scrollElement = getScrollElement();
    if (!scrollElement) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width * dpr;
    const height = rect.height * dpr;

    canvas.width = width;
    canvas.height = height;
    ctx.scale(dpr, dpr);

    // Dark theme colors
    const bgColor = '#1a1a1a';
    const userColor = '#3b82f6'; // blue
    const botColor = '#10b981'; // green
    const viewportColor = '#f59e0b'; // amber for highlight
    const borderColor = '#404040';

    // Fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, rect.width, rect.height);

    // Calculate viewport position and size
    const scrollHeight = scrollElement.scrollHeight || 1;
    const clientHeight = scrollElement.clientHeight || 1;
    const scrollTop = scrollElement.scrollTop || 0;

    const viewportHeight = Math.max(10, (clientHeight / scrollHeight) * rect.height);
    const scrollRatio = scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0;
    const viewportTop = Math.max(0, scrollRatio * (rect.height - viewportHeight));

    // Draw message bars
    const barHeight = Math.max(1, rect.height / messages.length);
    messages.forEach((msg, index) => {
      const y = (index / messages.length) * rect.height;
      const color = msg.role === 'user' ? userColor : botColor;
      
      ctx.fillStyle = color;
      ctx.fillRect(2, y, rect.width - 4, barHeight);
    });

    // Draw viewport highlight
    ctx.strokeStyle = viewportColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.strokeRect(1, viewportTop, rect.width - 2, viewportHeight);
    ctx.globalAlpha = 1;
  }, [messages, scrollRef, isVisible]);

  // Handle click to scroll
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const scrollElement = getScrollElement();
    if (!scrollElement || !canvasRef.current || messages.length === 0) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const clickRatio = Math.max(0, Math.min(1, clickY / rect.height));

    const totalScroll = (scrollElement.scrollHeight || 0) - (scrollElement.clientHeight || 0);
    if (totalScroll > 0) {
      scrollElement.scrollTop = clickRatio * totalScroll;
    }
  };

  if (!isVisible || messages.length === 0) return null;

  return (
    <div className="hidden lg:flex flex-col h-full w-12 border-l border-border/50 bg-card/40 backdrop-blur-sm p-1">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="flex-1 w-full cursor-pointer hover:bg-card/60 transition-colors rounded"
      />
    </div>
  );
};

export default ChatMinimap;
