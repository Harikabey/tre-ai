-- Create public bucket for AI-generated downloadable files (pptx, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-files', 'generated-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read access
CREATE POLICY "Generated files are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'generated-files');

-- Authenticated users can upload to their own folder (user_id/filename)
CREATE POLICY "Authenticated users can upload generated files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'generated-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own generated files
CREATE POLICY "Users can delete their own generated files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'generated-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);