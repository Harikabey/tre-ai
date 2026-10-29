import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

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

const requireAuthenticatedUserId = async (expectedUserId: string): Promise<string> => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user || user.id !== expectedUserId) {
    throw new Error('Oturum doğrulanamadı. Lütfen yeniden giriş yapın.');
  }
  return user.id;
};

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
    } else {
      setMemories([]);
      setInterests([]);
      setRecentMoods([]);
      setCurrentMood(null);
    }
  }, [user]);

  const loadMemories = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('user_memories')
      .select('id, memory_type, category, content, importance, is_active, created_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('importance', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('Failed to load user memories:', error);
      toast.error('Hafıza kayıtları yüklenemedi.');
    } else if (data) {
      const { data: { user: authenticatedUser } } = await supabase.auth.getUser();
      if (authenticatedUser?.id === user.id) setMemories(data as UserMemory[]);
    }
  };

  const loadInterests = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('user_interests')
      .select('*')
      .eq('user_id', user.id)
      .order('strength', { ascending: false })
      .limit(20);
    
    if (!error && data) {
      const { data: { user: authenticatedUser } } = await supabase.auth.getUser();
      if (authenticatedUser?.id === user.id) setInterests(data as UserInterest[]);
    } else if (error) {
      console.error('Failed to load user interests:', error);
      toast.error('İlgi alanları yüklenemedi.');
    }
  };

  const loadRecentMoods = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('mood_history')
      .select('id, mood, mood_score, emotions, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('Failed to load recent moods:', error);
      toast.error('Duygu geçmişi yüklenemedi.');
    } else if (data) {
      const { data: { user: authenticatedUser } } = await supabase.auth.getUser();
      if (authenticatedUser?.id === user.id) {
        setRecentMoods(data.map(m => ({
          ...m,
          emotions: Array.isArray(m.emotions) ? m.emotions : []
        })) as MoodRecord[]);
      }
    }
  };

  const analyzeAndStore = useCallback(async (
    message: string, 
    conversationId: string,
    messageId?: string,
    conversationHistory?: Array<{role: string; content: string}>,
  ) => {
    if (!user) return null;

    try {
      const { data: { user: authenticatedUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authenticatedUser || authenticatedUser.id !== user.id) {
        throw authError ?? new Error('Oturum doğrulanamadı.');
      }
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Oturum tokenı bulunamadı.');

      const response = await fetch(ANALYZE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message, conversationHistory }),
      });

      if (!response.ok) {
        console.error('Analysis failed:', response.status, response.statusText);
        toast.error('Sohbetten hafıza bilgisi çıkarılamadı.');
        return null;
      }

      const result = await response.json();
      
      if (result.mood) {
        setCurrentMood({
          mood: result.mood.mood,
          suggested_tone: result.mood.suggested_tone
        });

        const { error } = await supabase.from('mood_history').insert({
          user_id: user.id,
          conversation_id: conversationId,
          ...(messageId ? { message_id: messageId } : {}),
          mood: result.mood.mood,
          mood_score: result.mood.mood_score,
          emotions: result.mood.emotions || []
        });
        if (error) {
          console.error('Failed to save mood history:', error);
          toast.error('Duygu analizi kaydedilemedi.');
        }
      }

      if (result.memories?.memories?.length > 0) {
        for (const memory of result.memories.memories) {
          const { data: existing, error: lookupError } = await supabase
            .from('user_memories')
            .select('id, content')
            .eq('user_id', user.id)
            .eq('category', memory.category)
            .ilike('content', `%${memory.content.slice(0, 20)}%`)
            .limit(1);

          if (lookupError) {
            console.error('Failed to check existing user memory:', lookupError);
            toast.error('Hafıza kayıtları kontrol edilemedi.');
            continue;
          }

          if (!existing || existing.length === 0) {
            const { error } = await supabase.from('user_memories').insert({
              user_id: user.id,
              memory_type: memory.type,
              category: memory.category,
              content: memory.content,
              importance: memory.importance,
              source_conversation_id: conversationId
            });
            if (error) {
              console.error('Failed to save user memory:', error);
              toast.error('Sohbetten öğrenilen bilgi kaydedilemedi.');
            }
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
    if (!user) return;
    const { data: { user: authenticatedUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authenticatedUser || authenticatedUser.id !== user.id) {
      toast.error('Hafıza silinemedi: oturum doğrulanamadı.');
      return;
    }
    const { error } = await supabase
      .from('user_memories')
      .delete()
      .eq('id', memoryId)
      .eq('user_id', authenticatedUser.id);
    if (error) {
      console.error('Failed to delete user memory:', error);
      toast.error('Hafıza silinemedi. Lütfen tekrar deneyin.');
      return;
    }
    setMemories(prev => prev.filter(m => m.id !== memoryId));
  }, [user]);

  const deleteInterest = useCallback(async (interestId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('user_interests')
      .delete()
      .eq('id', interestId)
      .eq('user_id', user.id);
    if (error) {
      console.error('Failed to delete user interest:', error);
      toast.error('İlgi alanı silinemedi.');
      return;
    }
    setInterests(prev => prev.filter(i => i.id !== interestId));
  }, [user]);

  const addMemory = useCallback(async (
    content: string,
    memory_type: UserMemory['memory_type'] = 'fact',
    category: string = 'genel',
    importance: number = 5
  ) => {
    if (!user || !content.trim()) return;
    const { data: { user: authenticatedUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authenticatedUser || authenticatedUser.id !== user.id) {
      toast.error('Hafıza eklenemedi: oturum doğrulanamadı.');
      return;
    }
    const { data, error } = await supabase
      .from('user_memories')
      .insert({
        user_id: authenticatedUser.id,
        content: content.trim(),
        memory_type,
        category: category.trim() || 'genel',
        importance,
      })
      .select()
      .single();
    if (!error && data) {
      setMemories(prev => [data as UserMemory, ...prev]);
    } else if (error) {
      console.error('Failed to add user memory:', error);
      toast.error('Hafıza eklenemedi. Lütfen tekrar deneyin.');
    }
  }, [user]);

  const updateMemory = useCallback(async (
    memoryId: string,
    updates: Partial<Pick<UserMemory, 'content' | 'memory_type' | 'category' | 'importance'>>
  ) => {
    if (!user) return;
    const { data: { user: authenticatedUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authenticatedUser || authenticatedUser.id !== user.id) {
      toast.error('Hafıza güncellenemedi: oturum doğrulanamadı.');
      return;
    }
    const { data, error } = await supabase
      .from('user_memories')
      .update(updates)
      .eq('id', memoryId)
      .eq('user_id', authenticatedUser.id)
      .select()
      .single();
    if (!error && data) {
      setMemories(prev => prev.map(m => (m.id === memoryId ? { ...m, ...(data as UserMemory) } : m)));
    } else if (error) {
      console.error('Failed to update user memory:', error);
      toast.error('Hafıza güncellenemedi. Lütfen tekrar deneyin.');
    }
  }, [user]);

  const addInterest = useCallback(async (interest: string, category: string = 'genel') => {
    if (!user || !interest.trim()) return;
    try {
      const authenticatedUserId = await requireAuthenticatedUserId(user.id);
      const { data, error } = await supabase
        .from('user_interests')
        .insert({
          user_id: authenticatedUserId,
          interest: interest.trim(),
          category: category.trim() || 'genel',
        })
        .select()
        .single();
      if (error) throw error;
      if (data) setInterests(prev => [data as UserInterest, ...prev]);
    } catch (error) {
      console.error('Failed to add user interest:', error);
      toast.error('İlgi alanı eklenemedi.');
    }
  }, [user]);

  const updateInterest = useCallback(async (
    interestId: string,
    updates: Partial<Pick<UserInterest, 'interest' | 'category' | 'strength'>>
  ) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('user_interests')
      .update(updates)
      .eq('id', interestId)
      .eq('user_id', user.id)
      .select()
      .single();
    if (!error && data) {
      setInterests(prev => prev.map(i => (i.id === interestId ? { ...i, ...(data as UserInterest) } : i)));
    } else if (error) {
      console.error('Failed to update user interest:', error);
      toast.error('İlgi alanı güncellenemedi.');
    }
  }, [user]);

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
    addMemory,
    updateMemory,
    addInterest,
    updateInterest,
    loadMemories,
    loadInterests,
  };
};
