import { useState, useCallback, useEffect } from 'react';
import { Message, KnowledgeItem } from '@/types/chatbot';

const STORAGE_KEY = 'ai_chatbot_knowledge';

const defaultKnowledge: Omit<KnowledgeItem, 'id'>[] = [
  { question: 'merhaba', answer: 'Merhaba! Size nasıl yardımcı olabilirim?', timestamp: new Date(), confidence: 1.0 },
  { question: 'nasılsın', answer: 'Teşekkür ederim, ben bir yapay zekayım. Size nasıl yardım edebilirim?', timestamp: new Date(), confidence: 1.0 },
  { question: 'teşekkürler', answer: 'Rica ederim! Başka bir sorunuz var mı?', timestamp: new Date(), confidence: 1.0 },
  { question: 'görüşürüz', answer: 'Görüşmek üzere! İyi günler.', timestamp: new Date(), confidence: 1.0 },
  { question: 'yapay zeka nedir', answer: 'Yapay zeka, makinelerin insan zekasını taklit etme yeteneğidir. Öğrenme, problem çözme ve karar verme gibi görevleri gerçekleştirebilir.', timestamp: new Date(), confidence: 1.0 },
  { question: 'sen kimsin', answer: 'Ben öğrenebilen bir yapay zeka chatbot\'uyum. Benimle sohbet ettikçe yeni şeyler öğrenebiliyorum!', timestamp: new Date(), confidence: 1.0 },
];

// Simple tokenizer
const tokenize = (text: string): string[] => {
  return text.toLowerCase().trim().split(/\s+/).filter(Boolean);
};

// Calculate similarity between two texts
const calculateSimilarity = (text1: string, text2: string): number => {
  const tokens1 = new Set(tokenize(text1));
  const tokens2 = new Set(tokenize(text2));
  
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.size / union.size;
};

export const useChatbot = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeItem[]>([]);
  const [isLearningMode, setIsLearningMode] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  // Load knowledge base from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setKnowledgeBase(parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        })));
      } catch {
        initializeDefaultKnowledge();
      }
    } else {
      initializeDefaultKnowledge();
    }
  }, []);

  const initializeDefaultKnowledge = () => {
    const knowledge = defaultKnowledge.map((item, index) => ({
      ...item,
      id: `default-${index}`,
    }));
    setKnowledgeBase(knowledge);
  };

  // Save knowledge base to localStorage
  useEffect(() => {
    if (knowledgeBase.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(knowledgeBase));
    }
  }, [knowledgeBase]);

  const findBestResponse = useCallback((question: string): { answer: string; confidence: number } => {
    if (knowledgeBase.length === 0) {
      return { answer: 'Henüz bir şey öğrenmedim. Bana bir şeyler öğretin!', confidence: 0 };
    }

    let bestMatch = { answer: '', confidence: 0 };

    for (const item of knowledgeBase) {
      const similarity = calculateSimilarity(question, item.question);
      if (similarity > bestMatch.confidence) {
        bestMatch = { answer: item.answer, confidence: similarity };
      }
    }

    if (bestMatch.confidence < 0.3) {
      return { 
        answer: 'Bu soruyu anlamadım. Bana öğretmek ister misiniz? "/öğret [cevap]" yazarak öğretebilirsiniz.', 
        confidence: 0 
      };
    }

    return bestMatch;
  }, [knowledgeBase]);

  const addMessage = useCallback((role: 'user' | 'bot', content: string) => {
    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role,
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, []);

  const learnNewResponse = useCallback((question: string, answer: string) => {
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

  const sendMessage = useCallback(async (input: string) => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    // Check for teach command
    if (trimmedInput.startsWith('/öğret ')) {
      const answer = trimmedInput.slice(7).trim();
      if (pendingQuestion && answer) {
        addMessage('user', trimmedInput);
        learnNewResponse(pendingQuestion, answer);
        setPendingQuestion(null);
        
        setIsTyping(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        setIsTyping(false);
        
        addMessage('bot', `✅ Öğrendim! "${pendingQuestion}" sorusuna "${answer}" yanıtını vereceğim.`);
        return;
      } else {
        addMessage('user', trimmedInput);
        addMessage('bot', '⚠️ Önce bana bir soru sorun, sonra cevabı öğretin.');
        return;
      }
    }

    // Add user message
    addMessage('user', trimmedInput);
    
    // Simulate typing
    setIsTyping(true);
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));
    setIsTyping(false);

    // Find response
    const { answer, confidence } = findBestResponse(trimmedInput);
    
    if (confidence < 0.3 && isLearningMode) {
      setPendingQuestion(trimmedInput);
    }

    addMessage('bot', answer);
  }, [addMessage, findBestResponse, isLearningMode, learnNewResponse, pendingQuestion]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setPendingQuestion(null);
  }, []);

  const clearKnowledge = useCallback(() => {
    setKnowledgeBase([]);
    localStorage.removeItem(STORAGE_KEY);
    initializeDefaultKnowledge();
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
