import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface UserMemory {
  id: string;
  memory_type: 'fact' | 'preference' | 'interest' | 'habit' | 'relationship' | 'goal';
  category: string;
  content: string;
  importance: number;
  is_active: boolean;
  created_at: string;
}

export interface UserInterest {
  id: string;
  interest: string;
  category: string;
  strength: number;
  mention_count: number;
  last_mentioned_at: string;
}

export interface MoodRecord {
  id: string;
  mood: string;
  mood_score: number;
  emotions: string[];
  created_at: string;
}

const ANALYZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-mood`;

export const useUserMemory = () => {
  const { user } = useAuth();
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [interests, setInterests] = useState<UserInterest[]>([]);
  const [recentMoods, setRecentMoods] = useState<MoodRecord[]>([]);
  const [currentMood, setCurrentMood] = useState<{ mood: string; suggested_tone: string } | null>(null);

  useEffect(() => {
    if (user) {
      loadMemories();
      loadInterests();
      loadRecentMoods();
    }
  }, [user]);

  const loadMemories = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('user_memories')
      .select('*')
      .eq('is_active', true)
      .order('importance', { ascending: false })
      .limit(50);
    
    if (!error && data) {
      setMemories(data as UserMemory[]);
    }
  };

  const loadInterests = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('user_interests')
      .select('*')
      .order('strength', { ascending: false })
      .limit(20);
    
    if (!error && data) {
      setInterests(data as UserInterest[]);
    }
  };

  const loadRecentMoods = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('mood_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (!error && data) {
      setRecentMoods(data.map(m => ({
        ...m,
        emotions: Array.isArray(m.emotions) ? m.emotions : []
      })) as MoodRecord[]);
    }
  };

  const analyzeAndStore = useCallback(async (
    message: string, 
    conversationId: string,
    messageId: string,
    conversationHistory?: Array<{role: string; content: string}>
  ) => {
    if (!user) return null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(ANALYZE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message, conversationHistory }),
      });

      if (!response.ok) {
        console.error('Analysis failed');
        return null;
      }

      const result = await response.json();
      
      if (result.mood) {
        setCurrentMood({
          mood: result.mood.mood,
          suggested_tone: result.mood.suggested_tone
        });

        await supabase.from('mood_history').insert({
          user_id: user.id,
          conversation_id: conversationId,
          message_id: messageId,
          mood: result.mood.mood,
          mood_score: result.mood.mood_score,
          emotions: result.mood.emotions || []
        });
      }

      if (result.memories?.memories?.length > 0) {
        for (const memory of result.memories.memories) {
          const { data: existing } = await supabase
            .from('user_memories')
            .select('id, content')
            .eq('user_id', user.id)
            .eq('category', memory.category)
            .ilike('content', `%${memory.content.slice(0, 20)}%`)
            .limit(1);

          if (!existing || existing.length === 0) {
            await supabase.from('user_memories').insert({
              user_id: user.id,
              memory_type: memory.type,
              category: memory.category,
              content: memory.content,
              importance: memory.importance,
              source_conversation_id: conversationId
            });
          }
        }
        loadMemories();
      }

      if (result.memories?.interests?.length > 0) {
        for (const interest of result.memories.interests) {
          const { data: existing } = await supabase
            .from('user_interests')
            .select('id, strength, mention_count')
            .eq('user_id', user.id)
            .eq('interest', interest.interest)
            .limit(1);

          if (existing && existing.length > 0) {
            await supabase
              .from('user_interests')
              .update({
                strength: Math.min(10, existing[0].strength + 1),
                mention_count: existing[0].mention_count + 1,
                last_mentioned_at: new Date().toISOString()
              })
              .eq('id', existing[0].id);
          } else {
            await supabase.from('user_interests').insert({
              user_id: user.id,
              interest: interest.interest,
              category: interest.category
            });
          }
        }
        loadInterests();
      }

      return result.mood;
    } catch (error) {
      console.error('Analysis error:', error);
      return null;
    }
  }, [user]);

  const getMemoryContext = useCallback((): string => {
    if (memories.length === 0 && interests.length === 0) return '';

    let context = '\n\n[KULLANICI HAFIZASI - Bu bilgileri yanıtlarında doğal şekilde kullan, direkt alıntılama]\n';
    
    // Group memories by category for better organization
    const memoryByCategory: Record<string, string[]> = {};
    const importantMemories = memories.filter(m => m.importance >= 5).slice(0, 15);
    importantMemories.forEach(m => {
      if (!memoryByCategory[m.category]) memoryByCategory[m.category] = [];
      memoryByCategory[m.category].push(m.content);
    });

    if (Object.keys(memoryByCategory).length > 0) {
      context += '\nKullanıcı Hakkında Bilgiler:\n';
      for (const [category, items] of Object.entries(memoryByCategory)) {
        context += `[${category}]: ${items.join('; ')}\n`;
      }
    }

    // Add interests with strength indicator
    const topInterests = interests.slice(0, 8);
    if (topInterests.length > 0) {
      context += '\nİlgi Alanları (güç sırasına göre):\n';
      topInterests.forEach(i => {
        const stars = '★'.repeat(Math.min(5, Math.ceil(i.strength / 2)));
        context += `- ${i.interest} (${i.category}) ${stars}\n`;
      });
    }

    // Mood trend analysis
    if (recentMoods.length >= 3) {
      const recentScores = recentMoods.slice(0, 5).map(m => m.mood_score || 0);
      const avgScore = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
      const trend = recentScores.length >= 2 
        ? (recentScores[0] > recentScores[recentScores.length - 1] ? 'yükseliyor' : 
           recentScores[0] < recentScores[recentScores.length - 1] ? 'düşüyor' : 'stabil')
        : 'stabil';
      
      context += `\n[Ruh hali trendi: ${trend}, ortalama: ${avgScore.toFixed(1)}]\n`;
      
      if (avgScore < -0.3) {
        context += '[⚠ Kullanıcı zor bir dönemden geçiyor, ekstra destekleyici ol]\n';
      } else if (avgScore > 0.5) {
        context += '[Kullanıcı pozitif bir dönemde, bu enerjiyi destekle]\n';
      }
    }

    return context;
  }, [memories, interests, recentMoods]);

  const getMoodContext = useCallback((): string => {
    if (!currentMood) return '';
    
    const moodTones: Record<string, string> = {
      'destekleyici': 'Kullanıcı desteğe ihtiyaç duyuyor. Empatik, anlayışlı ve cesaretlendirici ol.',
      'neşeli': 'Kullanıcı iyi bir ruh halinde. Enerjik ve pozitif ol.',
      'sakin': 'Sakin ve huzurlu bir ton kullan.',
      'motive_edici': 'Kullanıcıyı motive et, ilham ver.',
      'empatik': 'Derin empati göster, duygularını anla.',
      'bilgilendirici': 'Net ve bilgilendirici ol.'
    };

    let healingContext = '';
    if (recentMoods.length >= 3) {
      const recentScores = recentMoods.slice(0, 5).map(m => m.mood_score || 0);
      const avgScore = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
      const isDecline = recentScores.length >= 3 && recentScores[0] < recentScores[recentScores.length - 1] - 0.3;
      
      if (avgScore < -0.3 || isDecline) {
        // Include user's interests for personalized healing suggestions
        const userInterestNames = interests.slice(0, 3).map(i => i.interest).join(', ');
        healingContext = `

[DUYGUSAL İYİLEŞTİRME MODU AKTİF]
Kullanıcının ruh hali kötüye gidiyor. Şunları yap:
- Tonunu yumuşat ve ekstra empatik ol
- "Seni anlıyorum" gibi ifadeler kullan
${userInterestNames ? `- Kullanıcının ilgi alanlarından (${userInterestNames}) pozitif konulara yönlendir` : ''}
- Geçmişteki mutlu anılarını hatırlat (hafızada varsa)
- Pratik ve uygulanabilir öneriler sun`;
      }
    }

    return `\n[DUYGU DURUMU: ${currentMood.mood}]\n[ÖNERİLEN TON: ${moodTones[currentMood.suggested_tone] || currentMood.suggested_tone}]${healingContext}\n`;
  }, [currentMood, recentMoods, interests]);

  const deleteMemory = useCallback(async (memoryId: string) => {
    await supabase.from('user_memories').delete().eq('id', memoryId);
    setMemories(prev => prev.filter(m => m.id !== memoryId));
  }, []);

  const deleteInterest = useCallback(async (interestId: string) => {
    await supabase.from('user_interests').delete().eq('id', interestId);
    setInterests(prev => prev.filter(i => i.id !== interestId));
  }, []);

  return {
    memories,
    interests,
    recentMoods,
    currentMood,
    analyzeAndStore,
    getMemoryContext,
    getMoodContext,
    deleteMemory,
    deleteInterest,
    loadMemories,
    loadInterests,
  };
};
