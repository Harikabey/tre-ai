ALTER TABLE public.mood_history
  ADD COLUMN IF NOT EXISTS conversation_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.mood_history'::regclass
      AND conname = 'mood_history_conversation_id_fkey'
  ) THEN
    ALTER TABLE public.mood_history
      ADD CONSTRAINT mood_history_conversation_id_fkey
      FOREIGN KEY (conversation_id)
      REFERENCES public.conversations(id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

ALTER TABLE public.user_memories
  ADD COLUMN IF NOT EXISTS category TEXT;

UPDATE public.user_memories
SET category = 'general'
WHERE category IS NULL;

ALTER TABLE public.user_memories
  ALTER COLUMN category SET DEFAULT 'general',
  ALTER COLUMN category SET NOT NULL;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view messages in their conversations"
  ON public.messages;
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert messages in their conversations"
  ON public.messages;
CREATE POLICY "Users can insert messages in their conversations"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete messages in their conversations"
  ON public.messages;
CREATE POLICY "Users can delete messages in their conversations"
  ON public.messages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = (SELECT auth.uid())
    )
  );
