-- Make chat-attachments bucket private to prevent public URL access
UPDATE storage.buckets SET public = false WHERE id = 'chat-attachments';