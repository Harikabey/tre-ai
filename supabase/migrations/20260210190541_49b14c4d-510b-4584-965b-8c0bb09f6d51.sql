-- Enable pgvector extension for semantic memory search
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Add embedding column to user_memories for vector search
ALTER TABLE public.user_memories 
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Create index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_user_memories_embedding 
ON public.user_memories 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create function for semantic memory search
CREATE OR REPLACE FUNCTION public.search_memories(
  query_embedding vector(768),
  match_user_id uuid,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  content text,
  category text,
  memory_type text,
  importance integer,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    um.id,
    um.content,
    um.category,
    um.memory_type,
    um.importance,
    1 - (um.embedding <=> query_embedding) AS similarity
  FROM user_memories um
  WHERE um.user_id = match_user_id
    AND um.is_active = true
    AND um.embedding IS NOT NULL
    AND 1 - (um.embedding <=> query_embedding) > match_threshold
  ORDER BY um.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;