import { useState, useCallback, useEffect, useRef } from 'react';
import { Message, KnowledgeItem } from '@/types/chatbot';

const STORAGE_KEY = 'ai_chatbot_knowledge';
const HISTORY_KEY = 'ai_chatbot_history';
const PERSONALITY_KEY = 'ai_chatbot_personality';
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const defaultKnowledge: KnowledgeItem[] = [
  { id: 'default-0', question: 'merhaba', answer: 'Merhaba! Size nasıl yardımcı olabilirim?', timestamp: new Date(), confidence: 1.0 },
  { id: 'default-1', question: 'nasılsın', answer: 'Teşekkür ederim, ben bir yapay zekayım. Size nasıl yardım edebilirim?', timestamp: new Date(), confidence: 1.0 },
  { id: 'default-2', question: 'teşekkürler', answer: 'Rica ederim! Başka bir sorunuz var mı?', timestamp: new Date(), confidence: 1.0 },
];

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export const useChatbot = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeItem[]>(defaultKnowledge);
  const [isLearningMode, setIsLearningMode] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const initialized = useRef(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setKnowledgeBase(parsed.map((item: KnowledgeItem) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        })));
      }
    } catch (e) {
      console.error('Error loading knowledge:', e);
    }
    
    try {
      const historyStored = localStorage.getItem(HISTORY_KEY);
      if (historyStored) {
        setConversationHistory(JSON.parse(historyStored));
      }
    } catch (e) {
      console.error('Error loading history:', e);
    }
  }, []);

  // Save knowledge base to localStorage
  useEffect(() => {
    if (knowledgeBase.length > 0 && initialized.current) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(knowledgeBase));
    }
  }, [knowledgeBase]);

  // Save conversation history
  useEffect(() => {
    if (conversationHistory.length > 0 && initialized.current) {
      const trimmed = conversationHistory.slice(-20);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    }
  }, [conversationHistory]);

  const addMessage = useCallback((role: 'user' | 'bot', content: string): Message => {
    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role,
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, []);

  const updateLastBotMessage = useCallback((content: string) => {
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.role === 'bot') {
        return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content } : m));
      }
      return [...prev, {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'bot' as const,
        content,
        timestamp: new Date(),
      }];
    });
  }, []);

  const learnNewResponse = useCallback((question: string, answer: string): KnowledgeItem => {
    const newItem: KnowledgeItem = {
      id: `learn-${Date.now()}`,
      question: question.toLowerCase().trim(),
      answer,
      timestamp: new Date(),
      confidence: 1.0,
    };
    setKnowledgeBase(prev => [...prev, newItem]);
    return newItem;
  }, []);

  const streamChat = useCallback(async (userMessage: string): Promise<string> => {
    const newHistory: ChatMessage[] = [...conversationHistory, { role: 'user', content: userMessage }];
    const personality = localStorage.getItem(PERSONALITY_KEY) || 'friendly';
    
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: newHistory, personality }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({ error: 'Bağlantı hatası' }));
      throw new Error(errorData.error || `HTTP ${resp.status}`);
    }

    if (!resp.body) throw new Error("Stream desteklenmiyor");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantContent += content;
            updateLastBotMessage(assistantContent);
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantContent += content;
            updateLastBotMessage(assistantContent);
          }
        } catch { /* ignore */ }
      }
    }

    setConversationHistory([...newHistory, { role: 'assistant', content: assistantContent }]);
    
    return assistantContent;
  }, [conversationHistory, updateLastBotMessage]);

  const sendMessage = useCallback(async (input: string) => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    if (trimmedInput.startsWith('/öğret ')) {
      const answer = trimmedInput.slice(7).trim();
      if (pendingQuestion && answer) {
        addMessage('user', trimmedInput);
        learnNewResponse(pendingQuestion, answer);
        setPendingQuestion(null);
        addMessage('bot', `✅ Öğrendim! "${pendingQuestion}" sorusuna "${answer}" yanıtını vereceğim.`);
        return;
      } else {
        addMessage('user', trimmedInput);
        addMessage('bot', '⚠️ Önce bana bir soru sorun, sonra cevabı öğretin.');
        return;
      }
    }

    addMessage('user', trimmedInput);
    setIsTyping(true);

    try {
      await streamChat(trimmedInput);
    } catch (error) {
      console.error('Chat error:', error);
      updateLastBotMessage(
        error instanceof Error 
          ? `❌ ${error.message}` 
          : '❌ Bir hata oluştu. Lütfen tekrar deneyin.'
      );
    } finally {
      setIsTyping(false);
    }
  }, [addMessage, learnNewResponse, pendingQuestion, streamChat, updateLastBotMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setPendingQuestion(null);
    setConversationHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }, []);

  const clearKnowledge = useCallback(() => {
    setKnowledgeBase(defaultKnowledge);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const deleteKnowledgeItem = useCallback((id: string) => {
    setKnowledgeBase(prev => prev.filter(item => item.id !== id));
  }, []);

  return {
    messages,
    knowledgeBase,
    isLearningMode,
    isTyping,
    pendingQuestion,
    setIsLearningMode,
    sendMessage,
    clearMessages,
    clearKnowledge,
    learnNewResponse,
    deleteKnowledgeItem,
  };
};
