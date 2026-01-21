-- Create user_memories table for storing learned facts about users
CREATE TABLE public.user_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('fact', 'preference', 'interest', 'habit', 'relationship', 'goal')),
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  importance INTEGER DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
  source_conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create mood_history table for tracking emotional states
CREATE TABLE public.mood_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  mood TEXT NOT NULL,
  mood_score NUMERIC(3,2) CHECK (mood_score >= -1 AND mood_score <= 1),
  emotions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_interests table for interest mapping
CREATE TABLE public.user_interests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  interest TEXT NOT NULL,
  category TEXT NOT NULL,
  strength INTEGER DEFAULT 1 CHECK (strength >= 1 AND strength <= 10),
  last_mentioned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  mention_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, interest)
);

-- Enable RLS on all new tables
ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_memories
CREATE POLICY "Users can view their own memories" ON public.user_memories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own memories" ON public.user_memories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own memories" ON public.user_memories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own memories" ON public.user_memories FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for mood_history
CREATE POLICY "Users can view their own mood history" ON public.mood_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own mood records" ON public.mood_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own mood records" ON public.mood_history FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for user_interests
CREATE POLICY "Users can view their own interests" ON public.user_interests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own interests" ON public.user_interests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own interests" ON public.user_interests FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own interests" ON public.user_interests FOR DELETE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_user_memories_updated_at BEFORE UPDATE ON public.user_memories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_interests_updated_at BEFORE UPDATE ON public.user_interests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();