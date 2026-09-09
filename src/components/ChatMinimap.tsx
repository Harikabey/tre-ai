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

  // Draw minimap
  useEffect(() => {
    if (!canvasRef.current || !scrollRef.current || !isVisible || messages.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

    // Calculate total content height (proportional to message count)
    const totalHeight = messages.length * 8; // Each message gets 8px height in minimap
    const viewportHeight = (rect.height / totalHeight) * rect.height;
    const scrollElement = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    
    if (!scrollElement) return;

    const scrollRatio = scrollElement.scrollTop / (scrollElement.scrollHeight - scrollElement.clientHeight || 1);
    const viewportTop = scrollRatio * (rect.height - viewportHeight);

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
    const scrollElement = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    if (!scrollElement || !canvasRef.current || messages.length === 0) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const clickRatio = Math.max(0, Math.min(1, clickY / rect.height));

    const totalScroll = scrollElement.scrollHeight - scrollElement.clientHeight;
    scrollElement.scrollTop = clickRatio * totalScroll;
  };

  if (!isVisible || messages.length === 0) return null;

  return (
    <div className="hidden lg:flex flex-col w-12 border-l border-border/50 bg-card/40 backdrop-blur-sm p-1">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="flex-1 cursor-pointer hover:bg-card/60 transition-colors rounded"
        style={{ minHeight: '200px' }}
      />
    </div>
  );
};

export default ChatMinimap;
