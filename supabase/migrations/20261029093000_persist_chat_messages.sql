ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS user_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.conversations'::regclass
      AND conname = 'conversations_id_user_id_key'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_id_user_id_key UNIQUE (id, user_id);
  END IF;
END;
$$;

UPDATE public.messages AS message
SET user_id = conversation.user_id
FROM public.conversations AS conversation
WHERE message.conversation_id = conversation.id
  AND message.user_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.messages'::regclass
      AND conname = 'messages_user_id_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.messages'::regclass
      AND conname = 'messages_conversation_user_id_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_conversation_user_id_fkey
      FOREIGN KEY (conversation_id, user_id)
      REFERENCES public.conversations(id, user_id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

ALTER TABLE public.messages
  ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_user_id
  ON public.messages(user_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.conversations;

CREATE POLICY "Users can view their own conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own conversations"
  ON public.conversations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own conversations"
  ON public.conversations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can update messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can delete messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;

CREATE POLICY "Users can view their own messages"
  ON public.messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own messages"
  ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own messages"
  ON public.messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own memories" ON public.user_memories;
DROP POLICY IF EXISTS "Users can insert their own memories" ON public.user_memories;
DROP POLICY IF EXISTS "Users can update their own memories" ON public.user_memories;
DROP POLICY IF EXISTS "Users can delete their own memories" ON public.user_memories;

CREATE POLICY "Users can view their own memories"
  ON public.user_memories FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own memories"
  ON public.user_memories FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own memories"
  ON public.user_memories FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own memories"
  ON public.user_memories FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
