-- FILE: supabase/migrations/20261003155200_add_avatars_storage.sql
-- Create a public avatar bucket with a 2 MB file-size limit.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND storage.filename(name) ~ ('^' || auth.uid()::text || '\.(jpg|jpeg|png|webp|gif)$')
);

DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND storage.filename(name) ~ ('^' || auth.uid()::text || '\.(jpg|jpeg|png|webp|gif)$')
)
WITH CHECK (
  bucket_id = 'avatars'
  AND storage.filename(name) ~ ('^' || auth.uid()::text || '\.(jpg|jpeg|png|webp|gif)$')
);

DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND storage.filename(name) ~ ('^' || auth.uid()::text || '\.(jpg|jpeg|png|webp|gif)$')
);
