import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message, KnowledgeItem } from '@/types/chatbot';
import { useAuth } from './useAuth';
import { useUserMemory } from './useUserMemory';

// Voice mode state shared across components
let isVoiceModeActive = false;
export const setVoiceMode = (active: boolean) => { isVoiceModeActive = active; };
export const getVoiceMode = () => isVoiceModeActive;

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const PERSONALITY_KEY = 'ai_chatbot_personality';
const THINKING_MODE_KEY = 'ai_chatbot_thinking_mode';
const LANGUAGE_KEY = 'ai_chatbot_language';
const GENERATE_IMAGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`;
const GENERATE_GIF_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-gif`;
const GENERATE_PPTX_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-pptx`;
const GOOGLE_API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-api`;

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
  const { 
    analyzeAndStore, 
    getMemoryContext, 
    getMoodContext,
    memories,
    interests,
    recentMoods,
    currentMood,
    deleteMemory,
    deleteInterest
  } = useUserMemory();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<{provider: string; scopes: string[]; provider_email: string | null}[]>([]);
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

  // Load conversations and connected accounts when user changes
  useEffect(() => {
    if (user) {
      loadConversations();
      loadConnectedAccounts();
    } else {
      setConversations([]);
      setCurrentConversationId(null);
      setMessages([]);
      setConnectedAccounts([]);
    }
  }, [user]);

  const loadConnectedAccounts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('connected_accounts')
      .select('provider, scopes, provider_email')
      .eq('is_active', true);
    if (data) setConnectedAccounts(data as {provider: string; scopes: string[]; provider_email: string | null}[]);
  };

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
    
    const MAX_MSG_LEN = 6000;
    const MAX_HISTORY = 30;
    const conversationHistory: ChatMessage[] = (historyData || [])
      .slice(-MAX_HISTORY)
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content.length > MAX_MSG_LEN ? m.content.slice(0, MAX_MSG_LEN) + '...[kısaltıldı]' : m.content,
      }));
    
    const newHistory = [...conversationHistory, { role: 'user' as const, content: userMessage.slice(0, MAX_MSG_LEN) }];
    const personality = localStorage.getItem(PERSONALITY_KEY) || 'friendly';
    const language = localStorage.getItem(LANGUAGE_KEY) || 'tr';
    
    // Get memory and mood context for personalized responses
    const memoryContext = getMemoryContext();
    const moodContext = getMoodContext();

    // Collect user preferences for AI awareness
    const userPreferences = {
      theme: localStorage.getItem('ai_chatbot_theme') || 'dark',
      personality,
      language,
      voice_id: localStorage.getItem('trefriend_voice_id') || 'EXAVITQu4vr4xnSDxMaL',
      text_scale: parseFloat(localStorage.getItem('ai_chatbot_text_scale') || '1'),
      high_contrast: localStorage.getItem('ai_chatbot_high_contrast') === 'true',
      reduce_motion: localStorage.getItem('ai_chatbot_reduce_motion') === 'true',
      screen_share_enabled: localStorage.getItem('ai_chatbot_screen_share') === 'true',
    };
    
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-voice-mode": isVoiceModeActive ? "true" : "false",
      },
      body: JSON.stringify({ 
        messages: newHistory, 
        personality, 
        thinkingMode,
        memoryContext,
        moodContext,
        language,
        connectedAccounts,
        userPreferences,
      }),
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
  }, [updateLastBotMessage, connectedAccounts, thinkingMode, getMemoryContext, getMoodContext]);

  const generateImage = useCallback(async (prompt: string): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(GENERATE_IMAGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error('Görsel oluşturulamadı');
      }

      const data = await response.json();
      return data.imageUrl || null;
    } catch (error) {
      console.error('Image generation error:', error);
      return null;
    }
  }, []);

  const generateGif = useCallback(async (prompt: string): Promise<{ frames: string[]; delay: number } | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(GENERATE_GIF_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt, frameCount: 4 }),
      });

      if (!response.ok) {
        throw new Error('GIF oluşturulamadı');
      }

      const data = await response.json();
      if (data.frames && data.frames.length >= 2) {
        return { frames: data.frames, delay: data.delay || 500 };
      }
      return null;
    } catch (error) {
      console.error('GIF generation error:', error);
      return null;
    }
  }, []);

  const generatePptx = useCallback(async (prompt: string): Promise<{ url: string; fileName: string; title: string; slideCount: number } | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(GENERATE_PPTX_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) throw new Error('PPTX oluşturulamadı');
      const data = await response.json();
      if (!data.url) return null;
      return { url: data.url, fileName: data.fileName, title: data.title, slideCount: data.slideCount };
    } catch (error) {
      console.error('PPTX generation error:', error);
      return null;
    }
  }, []);

  // Detect if user message requires a Google API call
  const detectGoogleAction = useCallback((message: string): { action: string; params: Record<string, unknown> } | null => {
    const lower = message.toLowerCase();
    
    // Email patterns
    const emailPatterns = [
      /e-?posta/i, /mail/i, /gmail/i, /gelen kutu/i, /inbox/i,
      /mesaj.*oku/i, /mesaj.*kontrol/i, /mesaj.*bak/i, /postalar/i,
    ];
    if (emailPatterns.some(p => p.test(lower))) {
      const countMatch = lower.match(/son\s*(\d+)/);
      const maxResults = countMatch ? parseInt(countMatch[1]) : 5;
      return { action: 'gmail.list', params: { maxResults } };
    }

    // Calendar patterns
    const calendarPatterns = [
      /takvim/i, /randevu/i, /etkinlik/i, /toplantı/i, /calendar/i, /program/i,
    ];
    if (calendarPatterns.some(p => p.test(lower))) {
      return { action: 'calendar.list', params: { maxResults: 10 } };
    }

    // Drive patterns
    const drivePatterns = [
      /drive/i, /dosya/i, /belge/i, /doküman/i, /document/i,
    ];
    if (drivePatterns.some(p => p.test(lower))) {
      return { action: 'drive.list', params: { maxResults: 10 } };
    }

    return null;
  }, []);

  const callGoogleApi = useCallback(async (action: string, params: Record<string, unknown>): Promise<unknown> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const providerToken = session?.provider_token;

    const resp = await fetch(GOOGLE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, params, provider_token: providerToken }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({ error: 'API error' }));
      throw new Error(errData.error || `Google API error ${resp.status}`);
    }

    return await resp.json();
  }, []);

  // Read individual email details for summary
  const fetchEmailDetails = useCallback(async (messageIds: string[], maxCount: number = 5): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const providerToken = session?.provider_token;
    
    const details: string[] = [];
    const idsToFetch = messageIds.slice(0, maxCount);

    for (const msgId of idsToFetch) {
      try {
        const resp = await fetch(GOOGLE_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: 'gmail.read', params: { messageId: msgId }, provider_token: providerToken }),
        });

        if (resp.ok) {
          const result = await resp.json();
          const msg = result.data;
          const headers = msg?.payload?.headers || [];
          const from = headers.find((h: { name: string }) => h.name === 'From')?.value || 'Bilinmeyen';
          const subject = headers.find((h: { name: string }) => h.name === 'Subject')?.value || '(Konu yok)';
          const date = headers.find((h: { name: string }) => h.name === 'Date')?.value || '';
          const snippet = msg?.snippet || '';
          details.push(`- Kimden: ${from}\n  Konu: ${subject}\n  Tarih: ${date}\n  Özet: ${snippet}`);
        }
      } catch (e) {
        console.error('Email read error:', e);
      }
    }

    return details.join('\n\n');
  }, []);

  const sendMessage = useCallback(async (input: string, fileUrl?: string, generationType?: 'image' | 'gif') => {
    const trimmedInput = input.trim();
    if (!trimmedInput || !user) return;

    let conversationId = currentConversationId;
    
    // Create new conversation if needed
    if (!conversationId) {
      conversationId = await createNewConversation();
      if (!conversationId) return;
    }

    // Add user message to UI
    const userMessageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: trimmedInput,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    
    // Save user message to DB and get the actual ID
    const { data: savedMessage } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: trimmedInput,
      })
      .select('id')
      .single();
    
    const actualMessageId = savedMessage?.id || userMessageId;
    
    // Update conversation title if first message
    const currentConv = conversations.find(c => c.id === conversationId);
    if (currentConv?.title === 'Yeni Sohbet') {
      await updateConversationTitle(conversationId, trimmedInput);
    }

    setIsTyping(true);

    // Get conversation history for mood/memory analysis
    const { data: historyData } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(10);

    const conversationHistory = historyData?.map(m => ({
      role: m.role,
      content: m.content
    }));

    // Analyze mood and extract memories in the background (don't await)
    // Strip base64 image data to avoid exceeding the 10k char limit
    const messageForAnalysis = trimmedInput.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '[görsel]');
    if (messageForAnalysis.length <= 10000) {
      analyzeAndStore(messageForAnalysis, conversationId, actualMessageId, conversationHistory)
        .catch(err => console.error('Analysis failed:', err));
    }

    try {
      // Handle image generation request
      if (generationType === 'image') {
        const imagePrompt = trimmedInput.replace(/^🎨 Görsel oluştur:\s*/i, '').trim();
        updateLastBotMessage('🎨 Görsel oluşturuluyor...');
        
        const imageUrl = await generateImage(imagePrompt);
        
        if (imageUrl) {
          const responseContent = `İşte oluşturduğum görsel:\n\n![Oluşturulan görsel](${imageUrl})\n\n*"${imagePrompt}"*`;
          updateLastBotMessage(responseContent);
          await saveMessage(conversationId, 'assistant', responseContent);
        } else {
          const errorContent = '❌ Görsel oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.';
          updateLastBotMessage(errorContent);
          await saveMessage(conversationId, 'assistant', errorContent);
        }
      } else if (generationType === 'gif') {
        const gifPrompt = trimmedInput.replace(/^🎬 GIF oluştur:\s*/i, '').trim();
        updateLastBotMessage('🎬 GIF oluşturuluyor... (birden fazla kare üretiliyor)');
        
        const gifResult = await generateGif(gifPrompt);
        
        if (gifResult) {
          const framesJson = JSON.stringify(gifResult.frames);
          const responseContent = `İşte oluşturduğum animasyon:\n\n[ANIMATED_FRAMES]${framesJson}[/ANIMATED_FRAMES]\n\n*"${gifPrompt}"* (${gifResult.frames.length} kare)`;
          updateLastBotMessage(responseContent);
          await saveMessage(conversationId, 'assistant', responseContent);
        } else {
          const errorContent = '❌ GIF oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.';
          updateLastBotMessage(errorContent);
          await saveMessage(conversationId, 'assistant', errorContent);
        }
      } else if (/\b(powerpoint|pptx|sunum(?!cu)|sunu(?!cu)|slayt|presentation|sunum hazırla|sunum oluştur|sunum yap)\b/i.test(trimmedInput)) {
        // PPTX generation intent
        const pptxPrompt = trimmedInput
          .replace(/\b(powerpoint|pptx|sunum(?!cu)|sunu(?!cu)|slayt|presentation)\b/gi, '')
          .replace(/\b(hazırla|oluştur|yap|yarat|üret|ver)\b/gi, '')
          .replace(/\bbana\b/gi, '')
          .trim() || trimmedInput;
        updateLastBotMessage('📊 PowerPoint sunumu hazırlanıyor... (slaytlar tasarlanıyor)');
        const result = await generatePptx(pptxPrompt);
        if (result) {
          const responseContent = `İşte hazırladığım sunum: **${result.title}** (${result.slideCount} slayt)\n\n[Ek dosya: ${result.fileName}](${result.url})`;
          updateLastBotMessage(responseContent);
          await saveMessage(conversationId, 'assistant', responseContent);
        } else {
          const errorContent = '❌ Sunum oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.';
          updateLastBotMessage(errorContent);
          await saveMessage(conversationId, 'assistant', errorContent);
        }
      } else {
        // Check if user is requesting a connected account action
        const googleAction = connectedAccounts.length > 0 ? detectGoogleAction(trimmedInput) : null;

        if (googleAction) {
          // First check if we have a provider token
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          const providerToken = currentSession?.provider_token;

          if (!providerToken) {
            // No provider token - tell user to re-authenticate with Google
            const errorContent = '⚠️ Google hesabınıza erişmek için yeniden Google ile giriş yapmanız gerekiyor. Oturum tokenınız süresi dolmuş.\n\nLütfen çıkış yapıp Google ile tekrar giriş yapın.';
            updateLastBotMessage(errorContent);
            await saveMessage(conversationId!, 'assistant', errorContent);
          } else {
            // Show a loading message with unique ID for safe removal
            const loadingId = `loading-${Date.now()}`;
            setMessages(prev => [...prev, {
              id: loadingId,
              role: 'bot' as const,
              content: '🔄 Hesabınıza erişiliyor, bilgiler getiriliyor...',
              timestamp: new Date(),
            }]);

            try {
              let apiData: string;

              if (googleAction.action === 'gmail.list') {
                const result = await callGoogleApi(googleAction.action, googleAction.params) as { data?: { messages?: { id: string }[] } };
                const messageIds = result?.data?.messages?.map((m: { id: string }) => m.id) || [];
                
                if (messageIds.length === 0) {
                  apiData = 'Gelen kutusunda e-posta bulunamadı.';
                } else {
                  apiData = await fetchEmailDetails(messageIds, googleAction.params.maxResults as number || 5);
                }
              } else {
                const result = await callGoogleApi(googleAction.action, googleAction.params);
                apiData = JSON.stringify(result, null, 2);
              }

              if (!apiData || apiData.trim() === '') {
                throw new Error('API boş veri döndürdü');
              }

              // Stream a follow-up with the real data injected
              const contextMessage = `[SİSTEM: Kullanıcının Google hesabından çekilen GERÇEK veriler aşağıdadır. SADECE bu verileri kullan, KENDİN VERİ UYDURMA. Ham veriyi olduğu gibi gösterme, doğal dilde özetle.]\n\n${apiData}`;
              
              // Remove the loading message by ID
              setMessages(prev => prev.filter(m => m.id !== loadingId));
              
              const assistantContent = await streamChat(conversationId!, `${trimmedInput}\n\n${contextMessage}`);
              await saveMessage(conversationId!, 'assistant', assistantContent);
            } catch (apiError) {
              console.error('Google API call failed:', apiError);
              // Remove loading message
              setMessages(prev => prev.filter(m => m.id !== loadingId));
              // Show specific error instead of falling back to hallucination
              const errorMsg = apiError instanceof Error ? apiError.message : 'Bilinmeyen hata';
              const errorContent = `⚠️ Google hesabınızdan veri çekilirken hata oluştu: ${errorMsg}\n\nGoogle oturumunuz süresi dolmuş olabilir. Çıkış yapıp Google ile tekrar giriş yapmayı deneyin.`;
              updateLastBotMessage(errorContent);
              await saveMessage(conversationId!, 'assistant', errorContent);
            }
          }
        } else {
          // Normal chat flow
          const assistantContent = await streamChat(conversationId!, trimmedInput);
          
          // Save assistant message to DB
          await saveMessage(conversationId!, 'assistant', assistantContent);
        }
      }
      
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
  }, [user, currentConversationId, conversations, streamChat, updateLastBotMessage, thinkingMode, generateImage, generateGif, analyzeAndStore, connectedAccounts, detectGoogleAction, callGoogleApi, fetchEmailDetails]);

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
    // First delete all messages in the conversation (due to foreign key constraint)
    await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId);
    
    // Then delete the conversation
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

  const renameConversation = useCallback(async (conversationId: string, newTitle: string) => {
    const { error } = await supabase
      .from('conversations')
      .update({ title: newTitle })
      .eq('id', conversationId);
    
    if (!error) {
      setConversations(prev => 
        prev.map(c => c.id === conversationId ? { ...c, title: newTitle } : c)
      );
    }
  }, []);

  const deleteMessage = useCallback(async (messageId: string) => {
    // Delete from database
    await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);
    
    // Remove from local state
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);

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
    // Memory & mood data
    memories,
    interests,
    recentMoods,
    currentMood,
    // Functions
    setIsLearningMode,
    setThinkingMode: updateThinkingMode,
    sendMessage,
    clearMessages,
    deleteMessage,
    clearKnowledge,
    learnNewResponse,
    deleteKnowledgeItem,
    selectConversation,
    createNewConversation,
    deleteConversation,
    renameConversation,
    loadConversations,
    deleteMemory,
    deleteInterest,
  };
};
