
REVOKE EXECUTE ON FUNCTION public.search_memories(extensions.vector, uuid, double precision, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_memories(extensions.vector, uuid, double precision, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Generated files are publicly readable" ON storage.objects;
