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
const BUILD_APK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/build-apk`;
const GENERATE_PWA_SITE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-pwa-site`;
const GENERATE_ISO_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-iso`;
const GENERATE_AUDIO_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-audio`;
const CREATE_REMINDER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-reminder`;
const REMINDERS_ENABLED_KEY = 'ai_chatbot_reminders_enabled';

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
    deleteInterest,
    addMemory,
    updateMemory,
    addInterest,
    updateInterest,
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

  // Load the latest page of messages (offline-first from IndexedDB cache, then network)
  const loadMessages = async (conversationId: string) => {
    // 1) Instant render from compressed local cache
    try {
      const cached = await getCachedPage(conversationId, undefined, PAGE_SIZE);
      if (cached.length) {
        setMessages(cached.map(cachedToMessage));
        setHasMoreMessages(cached.length === PAGE_SIZE);
      }
    } catch (e) {
      console.warn('message cache read failed', e);
    }

    // 2) Refresh from server (last PAGE_SIZE messages)
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (!error && data) {
      const page = [...data].reverse();
      setMessages(page.map(m => ({
        id: m.id,
        role: m.role === 'user' ? 'user' as const : 'bot' as const,
        content: m.content,
        timestamp: new Date(m.created_at),
      })));
      setHasMoreMessages(page.length === PAGE_SIZE);
      cacheMessages(page.map(m => ({
        id: m.id,
        conversation_id: conversationId,
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.content,
        created_at: m.created_at,
      }))).catch(() => {});
    }
  };

  /** Infinite scroll-up: load the previous 20 messages (cache first, then server). */
  const loadOlderMessages = useCallback(async () => {
    const conversationId = currentConversationId;
    if (!conversationId || isLoadingOlder || !hasMoreMessages) return;
    const oldest = messages[0];
    if (!oldest) return;
    const before = oldest.timestamp.toISOString();

    setIsLoadingOlder(true);
    try {
      let page = await getCachedPage(conversationId, before, PAGE_SIZE);

      if (page.length < PAGE_SIZE) {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .lt('created_at', before)
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);
        if (data) {
          page = [...data].reverse().map(m => ({
            id: m.id,
            conversation_id: conversationId,
            role: m.role === 'user' ? 'user' as const : 'assistant' as const,
            content: m.content,
            created_at: m.created_at,
          }));
          cacheMessages(page).catch(() => {});
        }
      }

      if (page.length === 0) {
        setHasMoreMessages(false);
        return;
      }
      setMessages(prev => {
        const existing = new Set(prev.map(m => m.id));
        const older = page.filter(m => !existing.has(m.id)).map(cachedToMessage);
        return [...older, ...prev];
      });
      setHasMoreMessages(page.length === PAGE_SIZE);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [currentConversationId, isLoadingOlder, hasMoreMessages, messages]);

  const selectConversation = async (conversationId: string) => {
    setCurrentConversationId(conversationId);
    setHasMoreMessages(true);
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
        showThinking: localStorage.getItem('ai_chatbot_show_thinking') === 'true',
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

  // Generate a tiny PWA site (HTML+manifest+icon) hosted on Supabase storage.
  const generatePwaSite = useCallback(async (description: string): Promise<{
    siteUrl: string; manifestUrl: string; iconUrl: string;
    title: string; themeColor: string; backgroundColor: string;
  } | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const response = await fetch(GENERATE_PWA_SITE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ description }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Site üretilemedi');
    return data;
  }, []);

  // Build a real signed APK from a PWA URL via PWABuilder.
  const buildApk = useCallback(async (
    siteUrl: string,
    appName?: string,
    extras?: { manifestUrl?: string; iconUrl?: string; themeColor?: string; backgroundColor?: string },
  ): Promise<{ url: string; filename: string; appName: string; packageId: string } | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(BUILD_APK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: siteUrl, appName, ...extras }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'APK üretilemedi');
      return data;
    } catch (error) {
      console.error('APK build error:', error);
      throw error;
    }
  }, []);

  // Generate an ISO 9660 disk image from in-chat text (single text-file ISO by default).
  const generateIso = useCallback(async (
    files: Array<{ name: string; contentBase64: string }>,
    isoName?: string,
    volumeName?: string,
  ): Promise<{ url: string; filename: string; size: number; fileCount: number } | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(GENERATE_ISO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ files, isoName, volumeName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ISO üretilemedi');
      return data;
    } catch (error) {
      console.error('ISO generation error:', error);
      throw error;
    }
  }, []);

  // Generate MP3 audio (TTS or music) via ElevenLabs
  const generateAudio = useCallback(async (
    text: string,
    mode: 'tts' | 'music' = 'tts',
    duration?: number,
  ): Promise<{ url: string; fileName: string; mode: string } | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(GENERATE_AUDIO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text, mode, duration }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ses üretilemedi');
      return data;
    } catch (error) {
      console.error('Audio generation error:', error);
      return null;
    }
  }, []);

  // Generate an MP4 slideshow video from AI-generated images
  const generateMp4Slideshow = useCallback(async (
    prompt: string,
    frameCount = 4,
    secondsPerFrame = 2,
  ): Promise<{ url: string; fileName: string; frameCount: number } | null> => {
    try {
      // 1) Generate frames via the existing GIF endpoint (same image-gen pipeline)
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const gifResp = await fetch(GENERATE_GIF_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt, frameCount }),
      });
      if (!gifResp.ok) throw new Error('Kareler üretilemedi');
      const gifData = await gifResp.json();
      const frames: string[] = gifData.frames || [];
      if (frames.length < 2) throw new Error('Yeterli kare üretilemedi');

      // 2) Load images
      const imgs = await Promise.all(frames.map((src) => new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      })));

      // 3) Setup canvas
      const W = 720, H = 720;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context alınamadı');

      // 4) Pick best supported MIME (mp4 if Safari supports it, otherwise webm)
      const mp4Type = 'video/mp4;codecs=avc1.42E01E';
      const webmType = 'video/webm;codecs=vp9';
      const webmType2 = 'video/webm;codecs=vp8';
      let mimeType = '';
      let ext = 'mp4';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported(mp4Type)) { mimeType = mp4Type; ext = 'mp4'; }
        else if (MediaRecorder.isTypeSupported(webmType)) { mimeType = webmType; ext = 'webm'; }
        else if (MediaRecorder.isTypeSupported(webmType2)) { mimeType = webmType2; ext = 'webm'; }
      }
      if (!mimeType) throw new Error('Tarayıcı video kaydını desteklemiyor');

      // 5) Capture stream
      const fps = 30;
      const stream: MediaStream = (canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(fps);
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
      recorder.start();

      // 6) Draw frames with simple fade
      const frameDurationMs = Math.max(800, secondsPerFrame * 1000);
      const fadeMs = 250;
      const drawCover = (img: HTMLImageElement, alpha = 1) => {
        ctx.globalAlpha = alpha;
        const scale = Math.max(W / img.width, H / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
        ctx.globalAlpha = 1;
      };

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < imgs.length; i++) {
        // fade in
        const fadeSteps = 8;
        for (let s = 1; s <= fadeSteps; s++) {
          drawCover(imgs[i], s / fadeSteps);
          await sleep(fadeMs / fadeSteps);
        }
        drawCover(imgs[i], 1);
        await sleep(frameDurationMs - fadeMs);
      }
      // hold last frame briefly
      await sleep(400);
      recorder.stop();
      await stopped;
      stream.getTracks().forEach((t) => t.stop());

      const blob = new Blob(chunks, { type: mimeType });

      // 7) Upload to generated-files
      if (!user) throw new Error('Giriş gerekli');
      const fileName = `mp4-${Date.now()}.${ext}`;
      const path = `${user.id}/${fileName}`;
      const { error: upErr } = await supabase.storage
        .from('generated-files')
        .upload(path, blob, { contentType: mimeType.split(';')[0], upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('generated-files').getPublicUrl(path);
      return { url: pub.publicUrl, fileName, frameCount: imgs.length };
    } catch (error) {
      console.error('MP4 generation error:', error);
      return null;
    }
  }, [user]);

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
      } else if (/\b(hatırlat|hatirlat|hatırlatıcı|hatirlatici|remind me|reminder|set a reminder|remind|erinnere mich|rappelle-moi|recuérdame|recuerdame)\b/i.test(trimmedInput)) {
        // Reminder intent
        const enabled = localStorage.getItem(REMINDERS_ENABLED_KEY) === 'true';
        if (!enabled) {
          const msg = '🔔 Hatırlatıcı özelliği kapalı. Açmak için: Ayarlar → "Hatırlatıcılar" iznini etkinleştir. Ayrıca bildirimlerin de açık olması gerekir.';
          updateLastBotMessage(msg);
          await saveMessage(conversationId, 'assistant', msg);
        } else {
          updateLastBotMessage('⏰ Hatırlatıcı ayarlanıyor...');
          try {
            const { data: { session: s } } = await supabase.auth.getSession();
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
            const resp = await fetch(CREATE_REMINDER_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${s?.access_token}`,
              },
              body: JSON.stringify({ text: trimmedInput, timezone: tz, conversationId }),
            });
            const data = await resp.json();
            if (!resp.ok || !data?.reminder) throw new Error(data?.error || 'Hata');
            const when = new Date(data.reminder.remind_at).toLocaleString('tr-TR', { timeZone: tz });
            const bodyLine = data.reminder.body ? `\n\n📝 ${data.reminder.body}` : '';
            const msg = `✅ Hatırlatıcı kuruldu: **${data.reminder.title}**\n\n🕒 ${when}${bodyLine}\n\nZamanı geldiğinde bildirim ile hatırlatacağım.`;
            updateLastBotMessage(msg);
            await saveMessage(conversationId, 'assistant', msg);
          } catch (e) {
            const err = e instanceof Error ? e.message : 'Bilinmeyen hata';
            const msg = `❌ Hatırlatıcı kurulamadı: ${err}`;
            updateLastBotMessage(msg);
            await saveMessage(conversationId, 'assistant', msg);
          }
        }
      } else if (/\b(mp3|seslendir|ses dosyası|seslendirme|tts|metni oku|sesli oku)\b/i.test(trimmedInput) || /\b(müzik|melodi|şarkı|beste|jingle|enstrümantal|ses efekti|sfx)\b/i.test(trimmedInput) && /\b(oluştur|üret|yap|hazırla|yarat|ver)\b/i.test(trimmedInput)) {
        // MP3 generation: detect music vs TTS
        const isMusic = /\b(müzik|melodi|şarkı|beste|jingle|enstrümantal|ses efekti|sfx|music|song|melody)\b/i.test(trimmedInput);
        const cleanPrompt = trimmedInput
          .replace(/\b(mp3|tts|seslendir|seslendirme|ses dosyası|metni oku|sesli oku|müzik|melodi|şarkı|beste|jingle|enstrümantal|ses efekti|sfx)\b/gi, '')
          .replace(/\b(olarak|hazırla|oluştur|yap|yarat|üret|ver|bana|lütfen|bir)\b/gi, '')
          .replace(/^[:\-\s]+/, '')
          .trim() || trimmedInput;
        updateLastBotMessage(isMusic ? '🎵 Müzik üretiliyor...' : '🔊 Ses üretiliyor (seslendirme)...');
        const result = await generateAudio(cleanPrompt, isMusic ? 'music' : 'tts', isMusic ? 25 : undefined);
        if (result) {
          const label = isMusic ? 'müzik' : 'seslendirme';
          const responseContent = `İşte oluşturduğum ${label} (MP3):\n\n<audio controls src="${result.url}"></audio>\n\n[Ek dosya: ${result.fileName}](${result.url})`;
          updateLastBotMessage(responseContent);
          await saveMessage(conversationId, 'assistant', responseContent);
        } else {
          const errorContent = '❌ Ses üretilirken bir hata oluştu. Lütfen tekrar deneyin.';
          updateLastBotMessage(errorContent);
          await saveMessage(conversationId, 'assistant', errorContent);
        }
      } else if (/\b(mp4|video oluştur|video üret|video yap|slayt video|slideshow|kısa video)\b/i.test(trimmedInput)) {
        // MP4 slideshow generation
        const cleanPrompt = trimmedInput
          .replace(/\b(mp4|video|slayt video|slideshow|kısa video)\b/gi, '')
          .replace(/\b(olarak|hazırla|oluştur|yap|yarat|üret|ver|bana|lütfen|bir)\b/gi, '')
          .replace(/^[:\-\s]+/, '')
          .trim() || trimmedInput;
        updateLastBotMessage('🎬 MP4 video üretiliyor... (kareler hazırlanıyor, sonra video kodlanıyor)');
        const result = await generateMp4Slideshow(cleanPrompt, 4, 2);
        if (result) {
          const responseContent = `İşte oluşturduğum video (${result.frameCount} sahne):\n\n<video controls src="${result.url}" style="max-width:100%"></video>\n\n[Ek dosya: ${result.fileName}](${result.url})`;
          updateLastBotMessage(responseContent);
          await saveMessage(conversationId, 'assistant', responseContent);
        } else {
          const errorContent = '❌ Video üretilirken bir hata oluştu. Lütfen tekrar deneyin.';
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
      } else if (/\b(apk|android uygulaması|android app|android paketi|apk oluştur|apk yap|apk üret)\b/i.test(trimmedInput)) {
        // APK build intent. If user provided a URL → wrap that PWA. Otherwise → AI generates a tiny PWA, hosts it, then wraps it.
        const urlMatch = trimmedInput.match(/https?:\/\/[^\s)]+/i);
        try {
          let siteUrl: string | undefined;
          let extras: { manifestUrl?: string; iconUrl?: string; themeColor?: string; backgroundColor?: string } | undefined;
          let appName: string | undefined;

          if (urlMatch) {
            siteUrl = urlMatch[0];
            updateLastBotMessage('📱 APK üretiliyor... (PWABuilder ile imzalanıyor, 30-60 sn)');
          } else {
            // Build a description from the user's message (strip apk keywords).
            const description = trimmedInput
              .replace(/\b(apk|android uygulaması|android app|android paketi|apk oluştur|apk yap|apk üret|olarak|lütfen|bana|bir)\b/gi, '')
              .trim() || 'Modern minimalist bir mobil uygulama';
            updateLastBotMessage('🎨 Önce uygulama için PWA web sitesi tasarlanıyor...');
            const site = await generatePwaSite(description);
            if (!site) throw new Error('Site üretilemedi');
            siteUrl = site.siteUrl;
            extras = {
              manifestUrl: site.manifestUrl,
              iconUrl: site.iconUrl,
              themeColor: site.themeColor,
              backgroundColor: site.backgroundColor,
            };
            appName = site.title;
            updateLastBotMessage(`✅ Site hazır: **${site.title}**\n\n📱 Şimdi APK paketleniyor... (30-60 sn)`);
          }

          const result = await buildApk(siteUrl, appName, extras);
          if (result) {
            const responseContent = `✅ APK hazır: **${result.appName}**\n\nPaket: \`${result.packageId}\`\n\n[Ek dosya: ${result.filename}](${result.url})\n\n📦 ZIP içinde imzalanmış \`.apk\` (test/sideload) ve \`.aab\` (Google Play) bulunur.`;
            updateLastBotMessage(responseContent);
            await saveMessage(conversationId, 'assistant', responseContent);
          }
        } catch (e) {
          const err = e instanceof Error ? e.message : 'Bilinmeyen hata';
          const msg = `❌ APK oluşturulamadı: ${err}`;
          updateLastBotMessage(msg);
          await saveMessage(conversationId, 'assistant', msg);
        }
      } else if (/\b(iso|iso dosya|iso oluştur|iso yap|iso üret|disk imaj|cd imaj)\b/i.test(trimmedInput)) {
        // ISO generation intent — wrap the user's text content (or a placeholder) into an ISO.
        const cleaned = trimmedInput
          .replace(/\b(iso|iso dosyası|iso oluştur|iso yap|iso üret|disk imajı|cd imajı|bana|lütfen|olarak|bir|tek)\b/gi, '')
          .trim();
        const content = cleaned || 'Tre tarafından üretilen disk imajı.\n';
        const b64 = btoa(unescape(encodeURIComponent(content)));
        updateLastBotMessage('💿 ISO 9660 disk imajı oluşturuluyor...');
        try {
          const result = await generateIso(
            [{ name: 'README.TXT', contentBase64: b64 }],
            'tre-disk',
            'TRE_DISK',
          );
          if (result) {
            const sizeKb = (result.size / 1024).toFixed(1);
            const responseContent = `✅ ISO disk imajı hazır (${sizeKb} KB, ${result.fileCount} dosya)\n\n[Ek dosya: ${result.filename}](${result.url})\n\n💡 Daha fazla dosya eklemek istersen, dosyalarını sohbete yükle ve "bunlardan ISO yap" de.`;
            updateLastBotMessage(responseContent);
            await saveMessage(conversationId, 'assistant', responseContent);
          }
        } catch (e) {
          const err = e instanceof Error ? e.message : 'Bilinmeyen hata';
          const msg = `❌ ISO oluşturulamadı: ${err}`;
          updateLastBotMessage(msg);
          await saveMessage(conversationId, 'assistant', msg);
        }
      } else {
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
  }, [user, currentConversationId, conversations, streamChat, updateLastBotMessage, thinkingMode, generateImage, generateGif, generatePptx, generateAudio, generateMp4Slideshow, buildApk, generatePwaSite, generateIso, analyzeAndStore, connectedAccounts, detectGoogleAction, callGoogleApi, fetchEmailDetails]);

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

  const REACTION_REPLIES: Record<string, string> = {
    '👍': 'Ne güzel, mutlu oldum 😊',
    '😢': 'Anlıyorum, yanındayım. Konuşmak ister misin?',
    '😡': 'Sakinleşmene yardım edebilirim. Birlikte derin nefes alalım.',
    '❤️': 'Teşekkür ederim. Ben de seni önemsiyorum.',
    '😂': 'Güldüğüne sevindim 😄',
    '😮': 'Bu seni şaşırttı değil mi? Anlatmak ister misin?',
  };

  const reactToMessage = useCallback(async (_messageId: string, emoji: string) => {
    const reply = REACTION_REPLIES[emoji];
    if (!reply) return;

    const convId = currentConversationId;
    const userReactionContent = `[Tepki: ${emoji}]`;

    const userMsg: Message = {
      id: `react-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: userReactionContent,
      timestamp: new Date(),
    };
    const botMsg: Message = {
      id: `react-bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'bot',
      content: reply,
      timestamp: new Date(Date.now() + 1),
    };

    setMessages(prev => [...prev, userMsg, botMsg]);

    if (convId) {
      try {
        await supabase.from('messages').insert([
          { conversation_id: convId, role: 'user', content: userReactionContent },
          { conversation_id: convId, role: 'bot', content: reply },
        ]);
      } catch (e) {
        console.error('reaction save failed', e);
      }
    }
  }, [currentConversationId]);

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
    reactToMessage,
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
    addMemory,
    updateMemory,
    addInterest,
    updateInterest,
  };
};
