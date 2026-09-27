-- Blocks Supabase's public REST API (anon/authenticated keys) from reading any table.
-- The NestJS API connects with the postgres role, which bypasses RLS.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
