ALTER TABLE public.user_memories
  ADD COLUMN IF NOT EXISTS category TEXT;

UPDATE public.user_memories
SET category = 'general'
WHERE category IS NULL;

ALTER TABLE public.user_memories
  ALTER COLUMN category SET DEFAULT 'general',
  ALTER COLUMN category SET NOT NULL;

NOTIFY pgrst, 'reload schema';
