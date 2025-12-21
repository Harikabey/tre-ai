import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message, KnowledgeItem } from '@/types/chatbot';
import { useAuth } from './useAuth';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const PERSONALITY_KEY = 'ai_chatbot_personality';
const THINKING_MODE_KEY = 'ai_chatbot_thinking_mode';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type ThinkingMode = 'fast' | 'deep';

interface Conversation {
  id: string;
  title: string;
  personality: string;
  created_at: string;
  updated_at: string;
}

export const useChatbot = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeItem[]>([]);
  const [isLearningMode, setIsLearningMode] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>(() => {
    return (localStorage.getItem(THINKING_MODE_KEY) as ThinkingMode) || 'fast';
  });

  const updateThinkingMode = useCallback((mode: ThinkingMode) => {
    setThinkingMode(mode);
    localStorage.setItem(THINKING_MODE_KEY, mode);
  }, []);

  // Load conversations when user changes
  useEffect(() => {
    if (user) {
      loadConversations();
    } else {
      setConversations([]);
      setCurrentConversationId(null);
      setMessages([]);
    }
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (!error && data) {
      setConversations(data);
      // Auto-select the most recent conversation
      if (data.length > 0 && !currentConversationId) {
        selectConversation(data[0].id);
      }
    }
  };

  const loadMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (!error && data) {
      setMessages(data.map(m => ({
        id: m.id,
        role: m.role === 'user' ? 'user' : 'bot',
        content: m.content,
        timestamp: new Date(m.created_at),
      })));
    }
  };

  const selectConversation = async (conversationId: string) => {
    setCurrentConversationId(conversationId);
    await loadMessages(conversationId);
  };

  const createNewConversation = async (): Promise<string | null> => {
    if (!user) return null;
    
    const personality = localStorage.getItem(PERSONALITY_KEY) || 'friendly';
    
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        title: 'Yeni Sohbet',
        personality,
      })
      .select()
      .single();
    
    if (!error && data) {
      setConversations(prev => [data, ...prev]);
      setCurrentConversationId(data.id);
      setMessages([]);
      return data.id;
    }
    return null;
  };

  const updateConversationTitle = async (conversationId: string, firstMessage: string) => {
    const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '');
    
    await supabase
      .from('conversations')
      .update({ title })
      .eq('id', conversationId);
    
    setConversations(prev => 
      prev.map(c => c.id === conversationId ? { ...c, title } : c)
    );
  };

  const saveMessage = async (conversationId: string, role: 'user' | 'assistant', content: string) => {
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
      });
  };

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

  const streamChat = useCallback(async (conversationId: string, userMessage: string): Promise<string> => {
    // Get all messages for context
    const { data: historyData } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    const conversationHistory: ChatMessage[] = historyData?.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })) || [];
    
    const newHistory = [...conversationHistory, { role: 'user' as const, content: userMessage }];
    const personality = localStorage.getItem(PERSONALITY_KEY) || 'friendly';
    
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: newHistory, personality, thinkingMode }),
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
    
    return assistantContent;
  }, [updateLastBotMessage]);

  const sendMessage = useCallback(async (input: string) => {
    const trimmedInput = input.trim();
    if (!trimmedInput || !user) return;

    let conversationId = currentConversationId;
    
    // Create new conversation if needed
    if (!conversationId) {
      conversationId = await createNewConversation();
      if (!conversationId) return;
    }

    // Add user message to UI
    const userMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: trimmedInput,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    
    // Save user message to DB
    await saveMessage(conversationId, 'user', trimmedInput);
    
    // Update conversation title if first message
    const currentConv = conversations.find(c => c.id === conversationId);
    if (currentConv?.title === 'Yeni Sohbet') {
      await updateConversationTitle(conversationId, trimmedInput);
    }

    setIsTyping(true);

    try {
      const assistantContent = await streamChat(conversationId, trimmedInput);
      
      // Save assistant message to DB
      await saveMessage(conversationId, 'assistant', assistantContent);
      
      // Update conversation updated_at
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
        
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
  }, [user, currentConversationId, conversations, streamChat, updateLastBotMessage, thinkingMode]);

  const clearMessages = useCallback(async () => {
    if (currentConversationId) {
      await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', currentConversationId);
    }
    setMessages([]);
    setPendingQuestion(null);
  }, [currentConversationId]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);
    
    setConversations(prev => prev.filter(c => c.id !== conversationId));
    
    if (currentConversationId === conversationId) {
      setCurrentConversationId(null);
      setMessages([]);
    }
  }, [currentConversationId]);

  const clearKnowledge = useCallback(() => {
    setKnowledgeBase([]);
  }, []);

  const deleteKnowledgeItem = useCallback((id: string) => {
    setKnowledgeBase(prev => prev.filter(item => item.id !== id));
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

  return {
    messages,
    conversations,
    currentConversationId,
    knowledgeBase,
    isLearningMode,
    isTyping,
    pendingQuestion,
    thinkingMode,
    setIsLearningMode,
    setThinkingMode: updateThinkingMode,
    sendMessage,
    clearMessages,
    clearKnowledge,
    learnNewResponse,
    deleteKnowledgeItem,
    selectConversation,
    createNewConversation,
    deleteConversation,
    loadConversations,
  };
};
