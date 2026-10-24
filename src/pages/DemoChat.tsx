// FILE: src/pages/DemoChat.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChatInput } from '@/components/ChatInput';
import { ChatMessage } from '@/components/ChatMessage';
import { Progress } from '@/components/ui/progress';
import { TypingIndicator } from '@/components/TypingIndicator';
import { useDemoLimit } from '@/hooks/useDemoLimit';
import { useLocalModel } from '@/hooks/useLocalModel';
import { useWebGPU } from '@/hooks/useWebGPU';
import { Message } from '@/types/chatbot';
import { ThinkingMode } from '@/hooks/useChatbot';

export const DemoChat = () => {
  const navigate = useNavigate();
  const { isUsed, markUsed } = useDemoLimit();
  const { isSupported, browserName, errorMessage } = useWebGPU();
  const {
    isLoading: isModelLoading,
    progress,
    isReady,
    error: modelError,
    loadModel,
    generateResponse,
  } = useLocalModel();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const requestInProgress = useRef(false);

  useEffect(() => {
    if (isSupported && !isUsed && !isReady && !isModelLoading) {
      void loadModel().catch((error: unknown) => {
        console.error('Demo model yüklenemedi:', error);
        setErrorMsg('Demo şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin.');
      });
    }
  }, [isSupported, isUsed, isReady, isModelLoading, loadModel]);

  const handleSend = async (text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText || isUsed || requestInProgress.current) {
      if (isUsed) setErrorMsg('Demo hakkın doldu. Kayıt olarak devam et.');
      return;
    }

    if (!isReady) {
      setErrorMsg(isModelLoading
        ? 'Demo hazırlanıyor... Model yüklemesinin tamamlanmasını bekleyin.'
        : 'Demo şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin.');
      return;
    }

    setErrorMsg(null);
    requestInProgress.current = true;
    setIsTyping(true);
    const userMessage: Message = {
      id: `demo-user-${Date.now()}`,
      role: 'user',
      content: trimmedText,
      timestamp: new Date(),
    };
    setMessages((previous) => [...previous, userMessage]);

    try {
      const reply = await generateResponse([{ role: 'user', content: trimmedText }]);
      const assistantMessage: Message = {
        id: `demo-assistant-${Date.now()}`,
        role: 'bot',
        content: reply,
        timestamp: new Date(),
      };
      setMessages((previous) => [...previous, assistantMessage]);
      markUsed();
    } catch (error) {
      console.error('Demo yanıtı üretilemedi:', error);
      setErrorMsg('Demo şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin.');
    } finally {
      requestInProgress.current = false;
      setIsTyping(false);
    }
  };

  const isPreparing = isSupported && !isUsed && !isReady &&
    (isModelLoading || !modelError);

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
          Demo Modu
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Demo modundan çık"
          className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/auth')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {!isSupported && (
        <div className="p-4">
          <Alert variant="destructive">
            <AlertTitle>WebGPU desteklenmiyor</AlertTitle>
            <AlertDescription>
              Demo modu için Chrome veya Edge kullanın. {browserName} tarayıcısı WebGPU desteği sunmuyor.
              {errorMessage ? ` ${errorMessage}` : ''}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {isPreparing && (
        <div className="space-y-2 px-4 pt-4" role="status">
          <div className="flex justify-between text-sm">
            <span>Demo hazırlanıyor...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} aria-label={`Model yükleme ilerlemesi: yüzde ${progress}`} />
        </div>
      )}

      {modelError && isSupported && !isUsed && (
        <div className="p-4">
          <Alert variant="destructive">
            <AlertTitle>Demo şu an kullanılamıyor</AlertTitle>
            <AlertDescription>{modelError}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {isTyping && <TypingIndicator />}
        {isUsed && (
          <div className="space-y-3 rounded-lg border border-border p-4 text-center" role="status">
            <p className="text-sm text-foreground">Demo hakkın doldu. Kayıt olarak devam et.</p>
            <Button className="w-full" onClick={() => navigate('/auth')} size="lg">
              Kayıt Ol
            </Button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="mx-4 mb-2 text-sm text-destructive" role="alert">
          {errorMsg}
        </div>
      )}

      {!isUsed && isSupported && (
        <div className="border-t border-border p-4">
          <ChatInput
            onSend={handleSend}
            disabled={isTyping || !isReady}
            thinkingMode={'fast' as ThinkingMode}
            onThinkingModeChange={() => {}}
          />
        </div>
      )}
    </div>
  );
};

export default DemoChat;
