export interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

export interface KnowledgeItem {
  id: string;
  question: string;
  answer: string;
  timestamp: Date;
  confidence: number;
}

export interface ChatbotState {
  messages: Message[];
  knowledgeBase: KnowledgeItem[];
  isLearningMode: boolean;
  isTyping: boolean;
}
