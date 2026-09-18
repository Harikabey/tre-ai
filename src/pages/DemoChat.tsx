import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatMessage } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { TypingIndicator } from '@/components/TypingIndicator';
import { Message } from '@/types/chatbot';
import { Button } from '@/components/ui/button';
import { ThinkingMode } from '@/hooks/useChatbot';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY = import.meta.env.VITE_TRE_DEMO_API_KEY;

export const DemoChat = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [demoCount, setDemoCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSend = async (text: string) => {
    if (demoCount >= 1 || isTyping) return;

    setErrorMsg(null);

    // Kullanıcı mesajı ekrana basılır
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // "Tre yazıyor..." animasyonu
    setIsTyping(true);

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: 'openrouter/free',
          messages: [{ role: 'user', content: text }],
        }),
      });

      if (!res.ok) throw new Error('API hatası');

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || 'Üzgünüm, bir cevap oluşturamadım.';

      // API'den cevap gelince Tre mesajı ekrana basılır
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setDemoCount(1);
    } catch {
      // Hata yönetimi: butonu sıfırla, kullanıcıya mesaj göster
      setDemoCount(0);
      setErrorMsg('Mesaj gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-background">
      {/* Üstte "Demo Modu" etiketi */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">
          Demo Modu
        </span>
      </div>

      {/* Mesajlar */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isTyping && <TypingIndicator />}
      </div>

      {/* Hata mesajı */}
      {errorMsg && (
        <div className="mx-4 mb-2 text-sm text-destructive">{errorMsg}</div>
      )}

      {/* ChatInput veya Demo doldu butonu */}
      <div className="p-4 border-t border-border">
        {demoCount >= 1 ? (
          <Button
            className="w-full"
            onClick={() => navigate('/auth')}
            size="lg"
          >
            Demo hakkınız doldu. Tre'ye tam erişim için kayıt olun.
          </Button>
        ) : (
          <ChatInput
            onSend={handleSend}
            disabled={isTyping}
            thinkingMode={'fast' as ThinkingMode}
            onThinkingModeChange={() => {}}
          />
        )}
      </div>
    </div>
  );
};

export default DemoChat;
